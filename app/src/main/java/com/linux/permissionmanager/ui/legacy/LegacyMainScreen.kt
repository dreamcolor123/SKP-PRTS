package com.linux.permissionmanager.ui.legacy

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.linux.permissionmanager.ui.legacy.components.GlassFloatingNavigationBar
import com.linux.permissionmanager.ui.legacy.components.GlassNavigationItem
import com.linux.permissionmanager.ui.legacy.theme.LocalChromeSurfaceAlpha
import com.linux.permissionmanager.ui.legacy.theme.LocalContentDrawsBehindNavigation
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

private val navigationItems = listOf(
    GlassNavigationItem("主页", Icons.Filled.Home, Icons.Outlined.Home),
    GlassNavigationItem("授权", Icons.Filled.Shield, Icons.Outlined.Shield),
    GlassNavigationItem("模块", Icons.Filled.Extension, Icons.Outlined.Extension),
    GlassNavigationItem("设置", Icons.Filled.Settings, Icons.Outlined.Settings),
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LegacyMainScreen(
    selectedPage: Int,
    onPageSelected: (Int) -> Unit,
    snackbarHostState: SnackbarHostState,
    glassNavigationEnabled: Boolean,
    glassNavigationTransparency: Float,
    glassHazeState: HazeState,
    home: @Composable (PaddingValues) -> Unit,
    superUser: @Composable (PaddingValues) -> Unit,
    modules: @Composable (PaddingValues) -> Unit,
    settings: @Composable (PaddingValues) -> Unit,
) {
    val pagerState = rememberPagerState(initialPage = selectedPage, pageCount = { 4 })
    val scope = rememberCoroutineScope()
    val latestSelectedPage by rememberUpdatedState(selectedPage)
    val latestOnPageSelected by rememberUpdatedState(onPageSelected)
    var navigationPage by remember { mutableIntStateOf(selectedPage) }
    var programmaticTarget by remember { mutableStateOf<Int?>(null) }
    var navigationJob by remember { mutableStateOf<Job?>(null) }

    fun navigateToPage(requestedPage: Int) {
        val page = requestedPage.coerceIn(0, 3)
        if (programmaticTarget == page) return

        // A new tab click supersedes the previous animation. Keeping an explicit target
        // prevents the cancelled animation's intermediate settledPage from feeding back
        // into MainViewModel and starting an animation in the opposite direction.
        navigationJob?.cancel()
        programmaticTarget = page
        navigationPage = page
        navigationJob = scope.launch {
            try {
                pagerState.animateScrollToPage(
                    page = page,
                    animationSpec = tween(durationMillis = 260, easing = FastOutSlowInEasing),
                )
            } finally {
                // A newer click owns the pager now; its job will perform the final sync.
                if (programmaticTarget == page) {
                    programmaticTarget = null
                    val settled = pagerState.settledPage
                    navigationPage = settled
                    if (latestSelectedPage != settled) latestOnPageSelected(settled)
                }
            }
        }
    }

    LaunchedEffect(selectedPage) {
        if (selectedPage != navigationPage && selectedPage != programmaticTarget) {
            navigateToPage(selectedPage)
        }
    }
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.settledPage }
            .distinctUntilChanged()
            .collect { page ->
                // User swipes update the selected navigation item only after settling.
                // Intermediate pages from a programmatic animation are deliberately ignored.
                if (programmaticTarget == null) {
                    navigationPage = page
                    if (latestSelectedPage != page) latestOnPageSelected(page)
                }
            }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        if (maxWidth >= 600.dp) {
            Box(Modifier.fillMaxSize()) {
                Row(Modifier.fillMaxSize()) {
                    NavigationRail(
                        modifier = Modifier.fillMaxHeight(),
                        containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = LocalChromeSurfaceAlpha.current),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxHeight()
                                .padding(vertical = 16.dp),
                            verticalArrangement = Arrangement.SpaceEvenly,
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            navigationItems.forEachIndexed { index, item ->
                                NavigationRailItem(
                                    selected = navigationPage == index,
                                    onClick = { navigateToPage(index) },
                                    icon = { Icon(if (navigationPage == index) item.selectedIcon else item.icon, item.label) },
                                    label = { Text(item.label) },
                                )
                            }
                        }
                    }
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.weight(1f),
                        beyondViewportPageCount = 3,
                    ) { page ->
                        MainPage(page, PaddingValues(0.dp), home, superUser, modules, settings)
                    }
                }
                // Keep the Snackbar in the content layer and anchor it explicitly. Without
                // this alignment a standalone SnackbarHost defaults to the top-left on tablets.
                SnackbarHost(
                    hostState = snackbarHostState,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                        .padding(16.dp),
                )
            }
        } else if (glassNavigationEnabled) {
            val navigationBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
            val floatingBarClearance = 88.dp + navigationBarInset
            Box(Modifier.fillMaxSize()) {
                CompositionLocalProvider(LocalContentDrawsBehindNavigation provides true) {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier
                            .fillMaxSize()
                            .hazeSource(glassHazeState, zIndex = 1f),
                        beyondViewportPageCount = 3,
                    ) { page ->
                        MainPage(
                            page,
                            PaddingValues(bottom = floatingBarClearance),
                            home,
                            superUser,
                            modules,
                            settings,
                        )
                    }
                }

                GlassFloatingNavigationBar(
                    items = navigationItems,
                    selectedIndex = navigationPage,
                    hazeState = glassHazeState,
                    transparency = glassNavigationTransparency,
                    onItemSelected = ::navigateToPage,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                )

                SnackbarHost(
                    hostState = snackbarHostState,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(
                            start = 16.dp,
                            end = 16.dp,
                            bottom = floatingBarClearance + 8.dp,
                        ),
                )
            }
        } else {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                bottomBar = {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(
                            alpha = LocalChromeSurfaceAlpha.current
                        ),
                        tonalElevation = 0.dp,
                    ) {
                        navigationItems.forEachIndexed { index, item ->
                            NavigationBarItem(
                                selected = navigationPage == index,
                                onClick = { navigateToPage(index) },
                                icon = {
                                    Icon(
                                        if (navigationPage == index) item.selectedIcon else item.icon,
                                        item.label,
                                    )
                                },
                                label = { Text(item.label) },
                            )
                        }
                    }
                },
                containerColor = Color.Transparent,
            ) { outerPadding ->
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                    beyondViewportPageCount = 3,
                ) { page ->
                    MainPage(page, outerPadding, home, superUser, modules, settings)
                }
            }
        }
    }
}

@Composable
private fun MainPage(
    page: Int,
    bottomPadding: PaddingValues,
    home: @Composable (PaddingValues) -> Unit,
    superUser: @Composable (PaddingValues) -> Unit,
    modules: @Composable (PaddingValues) -> Unit,
    settings: @Composable (PaddingValues) -> Unit,
) = when (page) {
    0 -> home(bottomPadding)
    1 -> superUser(bottomPadding)
    2 -> modules(bottomPadding)
    else -> settings(bottomPadding)
}
