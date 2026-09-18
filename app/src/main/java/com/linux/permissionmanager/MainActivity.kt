package com.linux.permissionmanager

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.linux.permissionmanager.data.LogPayload
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.UiEffect
import com.linux.permissionmanager.ui.*
import com.linux.permissionmanager.ui.rhine.*
import com.linux.permissionmanager.ui.components.GlassNavigationItem
import com.linux.permissionmanager.ui.components.TerminalNavigation
import com.linux.permissionmanager.ui.motion.LocalMotionActive
import com.linux.permissionmanager.ui.motion.TerminalBootOverlay
import com.linux.permissionmanager.ui.motion.rememberTerminalMotionEnabled
import com.linux.permissionmanager.ui.screens.*
import com.linux.permissionmanager.ui.theme.AppearanceBackground
import com.linux.permissionmanager.ui.theme.LocalChromeSurfaceAlpha
import com.linux.permissionmanager.ui.theme.LocalContentDrawsBehindNavigation
import com.linux.permissionmanager.ui.theme.SkpTheme
import com.linux.permissionmanager.utils.FileUtils
import com.linux.permissionmanager.utils.GetAppListPermissionHelper
import com.linux.permissionmanager.utils.ModuleWebUiShortcut
import com.linux.permissionmanager.utils.UrlIntentUtils
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : ComponentActivity() {
    private val mutableModuleWebUiShortcut = MutableStateFlow<String?>(null)
    internal val moduleWebUiShortcut: StateFlow<String?> = mutableModuleWebUiShortcut.asStateFlow()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) acceptModuleWebUiShortcut(intent)
        enableEdgeToEdge()
        setContent { SkpRoot() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        acceptModuleWebUiShortcut(intent)
    }

    internal fun consumeModuleWebUiShortcut(moduleId: String) {
        mutableModuleWebUiShortcut.compareAndSet(moduleId, null)
    }

    private fun acceptModuleWebUiShortcut(source: Intent?) {
        val shortcutIntent = source ?: return
        val moduleId = ModuleWebUiShortcut.resolveModuleId(shortcutIntent) ?: return
        mutableModuleWebUiShortcut.value = moduleId
        setIntent(Intent(shortcutIntent).apply { action = Intent.ACTION_MAIN })
    }
}

@Composable
private fun SkpRoot() {
    val context = LocalContext.current
    val application = context.applicationContext as PermissionManagerApplication
    val appearance by application.container.appearance.state.collectAsStateWithLifecycle()
    val backgroundPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            application.container.appearance.setBackground(uri)
            application.container.events.emit(UiEffect.Snackbar("已设置背景图片"))
        }
    }

    SkpTheme(appearance) {
        AppearanceBackground(
            appearance = appearance,
            onImageError = {
                if (appearance.backgroundEnabled) {
                    application.container.appearance.clearBackground()
                    application.container.events.emit(UiEffect.Snackbar("背景图片读取失败，已恢复纯色背景"))
                }
            },
        ) {
            SkpApp(
                application = application,
                appearance = appearance,
                onPickBackground = { backgroundPicker.launch(arrayOf("image/*")) },
            )
        }
    }
}

internal data class PendingLocalInstall(
    val file: File,
    val packageName: String,
)

private val navigationItems = listOf(
    GlassNavigationItem("主页", Icons.Filled.Home, Icons.Outlined.Home),
    GlassNavigationItem("授权", Icons.Filled.Shield, Icons.Outlined.Shield),
    GlassNavigationItem("模块", Icons.Filled.Extension, Icons.Outlined.Extension),
    GlassNavigationItem("设置", Icons.Filled.Settings, Icons.Outlined.Settings),
)

@Composable
private fun SkpApp(
    application: PermissionManagerApplication,
    appearance: AppearanceSettings,
    onPickBackground: () -> Unit,
) {
    val context = LocalContext.current
    val activity = context as MainActivity
    val factory = remember { AppViewModelFactory(application) }
    val rhineSession: RhineSessionViewModel = viewModel()
    val mainViewModel: MainViewModel = viewModel(factory = factory)
    val homeViewModel: HomeViewModel = viewModel(factory = factory)
    val superUserViewModel: SuperUserViewModel = viewModel(factory = factory)
    val moduleViewModel: ModuleViewModel = viewModel(factory = factory)
    val settingsViewModel: SettingsViewModel = viewModel(factory = factory)
    val localCustomizerViewModel: LocalCustomizerViewModel = viewModel(factory = factory)

    val mainState by mainViewModel.state.collectAsStateWithLifecycle()
    val homeState by homeViewModel.state.collectAsStateWithLifecycle()
    val superUserState by superUserViewModel.state.collectAsStateWithLifecycle()
    val moduleState by moduleViewModel.state.collectAsStateWithLifecycle()
    val settingsState by settingsViewModel.state.collectAsStateWithLifecycle()
    val localCustomizerState by localCustomizerViewModel.state.collectAsStateWithLifecycle()
    val shortcutModuleId by activity.moduleWebUiShortcut.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    var bootVisible by rememberSaveable { mutableStateOf(false) }
    var logPayload by rhineSession.logPayload
    var pendingRunOnce by rhineSession.pendingRunOnce
    var pendingStorageAction by rhineSession.pendingStorage
    var missingAppListPermission by remember { mutableStateOf(!GetAppListPermissionHelper.getPermissions(activity)) }
    var pendingExport by rhineSession.pendingExport
    var pendingInstall by rhineSession.pendingInstall
    var basicManagement by rhineSession.basicManagement
    val currentEntry by navController.currentBackStackEntryAsState()
    val systemMotionEnabled = rememberTerminalMotionEnabled()
    val installResultAction = remember(context.packageName) { "${context.packageName}.LOCAL_INSTALL_RESULT" }

    fun performStorageAction(action: RhineStorageAction) {
        when (action) {
            RhineStorageAction.REQUEST -> Unit
            RhineStorageAction.IMPORT_HOTLOAD -> mainViewModel.importHotloadFile()
            RhineStorageAction.EXPORT_HOTLOAD -> mainViewModel.exportHotloadFile()
            RhineStorageAction.EXPORT_LOG -> {
                val file = FileUtils.makeSdcardLogFile("skroot_log_", ".txt")
                FileUtils.writeTextAsync(activity, file, logPayload.content, true) { ok, out, error ->
                    scope.launch { snackbarHostState.showSnackbar(if (ok) "已导出至 ${out.absolutePath}" else "导出失败：$error") }
                }
            }
        }
    }

    val submitLocalInstall: (PendingLocalInstall) -> Unit = { request ->
        scope.launch {
            runCatching {
                commitLocalInstall(context, request, installResultAction)
            }.onFailure { error ->
                pendingInstall = null
                localCustomizerViewModel.installResult(false, "提交安装失败：${error.message ?: error.javaClass.simpleName}")
            }
        }
    }

    val customizerIconPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) localCustomizerViewModel.setIcon(uri)
    }
    val customizerExporter = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/vnd.android.package-archive")
    ) { uri: Uri? ->
        val request = pendingExport
        pendingExport = null
        if (uri == null || request == null) {
            if (request != null) scope.launch { snackbarHostState.showSnackbar("已取消导出") }
        } else {
            scope.launch {
                runCatching {
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                            request.inputStream().use { input -> input.copyTo(output) }
                        } ?: error("目标文件不可写")
                    }
                }.onSuccess {
                    snackbarHostState.showSnackbar("APK 已导出")
                }.onFailure { error ->
                    localCustomizerViewModel.exportResult(false, "导出失败：${error.message ?: error.javaClass.simpleName}")
                }
            }
        }
    }
    val unknownSourceSettings = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val request = pendingInstall
        if (request == null) return@rememberLauncherForActivityResult
        pendingInstall = null
        if (canRequestPackageInstalls(context)) {
            submitLocalInstall(request)
        } else {
            pendingInstall = null
            localCustomizerViewModel.installResult(false, "尚未允许此管理器安装未知来源应用")
        }
    }

    // ACTION_GET_CONTENT also exposes third-party file managers. OpenDocument
    // is tied to document providers and hid common standalone file managers.
    val modulePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val runOnce = pendingRunOnce
        pendingRunOnce = false
        if (uri != null) moduleViewModel.installUri(uri, runOnce)
    }
    val storageSettings = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val action = pendingStorageAction
        pendingStorageAction = null
        if (hasStorageAccess(context)) action?.let(::performStorageAction)
        else scope.launch { snackbarHostState.showSnackbar("未授予存储访问权限") }
        pendingStorageAction = null
    }
    val legacyStoragePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val action = pendingStorageAction
        pendingStorageAction = null
        if (result.values.all { it }) action?.let(::performStorageAction)
        else scope.launch { snackbarHostState.showSnackbar("未授予存储访问权限") }
        pendingStorageAction = null
    }

    DisposableEffect(context, installResultAction) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(receiverContext: Context, intent: Intent) {
                when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
                    PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        val confirmation = intent.packageInstallerConfirmationIntent()
                        if (confirmation == null) {
                            pendingInstall = null
                            localCustomizerViewModel.installResult(false, "系统没有返回安装确认界面")
                        } else {
                            runCatching {
                                confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                receiverContext.startActivity(confirmation)
                            }.onFailure { error ->
                                pendingInstall = null
                                localCustomizerViewModel.installResult(false, "打开安装确认失败：${error.message ?: error.javaClass.simpleName}")
                            }
                        }
                    }
                    PackageInstaller.STATUS_SUCCESS -> {
                        pendingInstall = null
                        localCustomizerViewModel.installResult(true, "定制管理器安装完成")
                    }
                    else -> {
                        val detail = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                            ?.takeIf(String::isNotBlank)
                            ?: packageInstallerStatusText(status)
                        pendingInstall = null
                        localCustomizerViewModel.installResult(false, "安装失败：$detail")
                    }
                }
            }
        }
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(installResultAction),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }

    fun withStorageAccess(action: RhineStorageAction) {
        if (hasStorageAccess(context)) {
            performStorageAction(action)
            return
        }
        pendingStorageAction = action
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            storageSettings.launch(
                Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${context.packageName}")
                }
            )
        } else {
            legacyStoragePermission.launch(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE))
        }
    }

    LaunchedEffect(mainState.activeRootKey) {
        homeViewModel.setRootKey(mainState.activeRootKey)
        superUserViewModel.setRootKey(mainState.activeRootKey)
        moduleViewModel.setRootKey(mainState.activeRootKey)
        settingsViewModel.setRootKey(mainState.activeRootKey)
    }

    LaunchedEffect(shortcutModuleId, mainState.activeRootKey) {
        val moduleId = shortcutModuleId ?: return@LaunchedEffect
        activity.consumeModuleWebUiShortcut(moduleId)
        mainViewModel.selectPage(2)
        moduleViewModel.openWebUiShortcut(moduleId, mainState.activeRootKey)
    }

    LaunchedEffect(Unit) {
        application.container.events.events.collect { effect ->
            when (effect) {
                is UiEffect.Snackbar -> scope.launch { snackbarHostState.showSnackbar(effect.message) }
                is UiEffect.OpenUrl -> UrlIntentUtils.openUrl(context, effect.url)
                is UiEffect.CopyText -> {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("SKRoot", effect.text))
                    snackbarHostState.showSnackbar(effect.confirmation)
                }
                is UiEffect.ShowLog -> {
                    logPayload = LogPayload(effect.title, effect.content)
                    if (navController.currentDestination?.route != "log") navController.navigate("log")
                }
                is UiEffect.PickModule -> {
                    pendingRunOnce = effect.runOnce
                    modulePicker.launch("*/*")
                }
                is UiEffect.PinModuleWebUiShortcut -> {
                    val result = ModuleWebUiShortcut.requestPin(context, effect.request)
                    snackbarHostState.showSnackbar(result.message)
                }
                UiEffect.PickCustomizerIcon -> customizerIconPicker.launch(arrayOf("image/*"))
                is UiEffect.ExportCustomizedApk -> {
                    pendingExport = effect.file
                    customizerExporter.launch(effect.suggestedName)
                }
                is UiEffect.InstallCustomizedApk -> {
                    val request = PendingLocalInstall(effect.file, effect.packageName)
                    pendingInstall = request
                    if (canRequestPackageInstalls(context)) {
                        submitLocalInstall(request)
                    } else {
                        runCatching {
                            unknownSourceSettings.launch(
                                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                                    data = Uri.parse("package:${context.packageName}")
                                }
                            )
                        }.onFailure { error ->
                            pendingInstall = null
                            localCustomizerViewModel.installResult(
                                false,
                                "打开未知来源设置失败：${error.message ?: error.javaClass.simpleName}",
                            )
                        }
                    }
                }
                UiEffect.ShowRootConfig -> mainViewModel.showRootConfig()
                UiEffect.RequestStorageAccess -> withStorageAccess(RhineStorageAction.REQUEST)
                UiEffect.FinishActivity -> activity.finish()
            }
        }
    }

    NavHost(navController = navController, startDestination = "main") {
        composable("main") {
            if (!basicManagement) {
                Box(Modifier.fillMaxSize()) {
                    RhineManagement(
                        application = application,
                        session = rhineSession,
                        main = mainViewModel,
                        home = homeViewModel,
                        authorization = superUserViewModel,
                        modules = moduleViewModel,
                        settings = settingsViewModel,
                        customizer = localCustomizerViewModel,
                        active = !mainState.rootConfig.visible && !mainState.rootConfig.busy && !localCustomizerState.visible &&
                            !missingAppListPermission && (currentEntry?.destination?.route ?: "main") == "main",
                        audioActive = (currentEntry?.destination?.route ?: "main") == "main",
                        reducedMotion = !systemMotionEnabled,
                        onConsole = { logPayload = LogPayload("控制台", it); navController.navigate("log") },
                        onLegacyAppearance = { mainViewModel.selectPage(3); basicManagement = true },
                    )
                    SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter).navigationBarsPadding())
                }
            } else {
            Column(Modifier.fillMaxSize()) {
                TextButton(onClick = { basicManagement = false }, modifier = Modifier.statusBarsPadding()) { Text("← 返回 SKRoot Pro 终端") }
                Box(Modifier.weight(1f)) {
            AdaptiveMainScreen(
                selectedPage = mainState.selectedPage,
                onPageSelected = mainViewModel::selectPage,
                snackbarHostState = snackbarHostState,
                motionEnabled = appearance.motionEnabled,
                contentActive = !bootVisible && !mainState.rootConfig.visible && !mainState.rootConfig.busy && !localCustomizerState.visible,
                home = {
                    HomeScreen(
                        state = homeState,
                        bottomPadding = it,
                        onConfigureRoot = mainViewModel::showRootConfig,
                        onRefresh = homeViewModel::refresh,
                        onInstall = {
                            homeViewModel.install(rootKey = mainState.activeRootKey)
                        },
                        onUninstall = homeViewModel::uninstall,
                        onTestRoot = homeViewModel::testRoot,
                        onRunCommand = homeViewModel::runCommand,
                        onCopyConsole = homeViewModel::copyConsole,
                        onClearConsole = homeViewModel::clearConsole,
                        onReboot = settingsViewModel::reboot,
                        onDismissCveSoftRebootPrompt = homeViewModel::dismissCveSoftRebootPrompt,
                    )
                },
                superUser = {
                    SuperUserScreen(
                        state = superUserState,
                        bottomPadding = it,
                        onRefresh = superUserViewModel::refresh,
                        onSearch = superUserViewModel::setQuery,
                        onShowPicker = superUserViewModel::showPicker,
                        onHidePicker = superUserViewModel::hidePicker,
                        onPickerSearch = superUserViewModel::setPickerQuery,
                        onFilterSystem = { value -> superUserViewModel.setFilters(system = value) },
                        onFilterThirdParty = { value -> superUserViewModel.setFilters(thirdParty = value) },
                        onAdd = superUserViewModel::add,
                        onAddAdb = superUserViewModel::addAdb,
                        onRemove = superUserViewModel::remove,
                        onClear = superUserViewModel::clear,
                    )
                },
                modules = {
                    ModuleScreen(
                        state = moduleState,
                        bottomPadding = it,
                        onSelectTab = moduleViewModel::selectTab,
                        onRefreshInstalled = moduleViewModel::refreshInstalled,
                        onRefreshMarket = moduleViewModel::refreshMarket,
                        onPickModule = moduleViewModel::requestPick,
                        onOpenGuide = { application.container.events.emit(UiEffect.OpenUrl("https://abcz316.github.io/SKRoot-linuxKernelRoot/skroot_pro_app/module_developer_help.pdf")) },
                        onMarketQuery = moduleViewModel::setMarketQuery,
                        onRemove = moduleViewModel::remove,
                        onDetails = moduleViewModel::showDetails,
                        onWebUi = moduleViewModel::openWebUi,
                        onCreateWebUiShortcut = moduleViewModel::requestWebUiShortcut,
                        onCheckUpdate = { moduleViewModel.checkUpdate(it) },
                        onChangelog = moduleViewModel::showChangelog,
                        onDownloadUpdate = moduleViewModel::downloadUpdate,
                        onDownloadMarket = moduleViewModel::downloadMarket,
                        onOpenUrl = { application.container.events.emit(UiEffect.OpenUrl(it)) },
                        onCancelDownload = moduleViewModel::cancelDownload,
                    )
                },
                settings = {
                    SettingsScreen(
                        state = settingsState,
                        appearance = appearance,
                        bottomPadding = it,
                        onRefresh = settingsViewModel::refresh,
                        onBootFailChange = settingsViewModel::setBootFail,
                        onAdbChange = settingsViewModel::setAdbDisabled,
                        onLogChange = settingsViewModel::setLogEnabled,
                        onUpdateCheckChange = settingsViewModel::setUpdateCheckEnabled,
                        onBasicTest = settingsViewModel::testBasic,
                        onModuleTest = settingsViewModel::testDefaultModule,
                        onShowLog = settingsViewModel::showLog,
                        onClearLog = settingsViewModel::clearLog,
                        onReboot = settingsViewModel::reboot,
                        onOpenUrl = settingsViewModel::openUrl,
                        onShowChangelog = settingsViewModel::showAppChangelog,
                        onPaletteChange = application.container.appearance::setPalette,
                        onPickBackground = onPickBackground,
                        onBackgroundAlphaChange = application.container.appearance::setBackgroundAlpha,
                        onChromeTransparencyChange = application.container.appearance::setChromeTransparency,
                        onControlTransparencyChange = application.container.appearance::setControlTransparency,
                        onGlassNavigationChange = application.container.appearance::setGlassNavigationEnabled,
                        onGlassNavigationTransparencyChange = application.container.appearance::setGlassNavigationTransparency,
                        onClearBackground = application.container.appearance::clearBackground,
                        onResetAppearance = application.container.appearance::reset,
                        onOpenLocalCustomizer = localCustomizerViewModel::show,
                        onThemeModeChange = application.container.appearance::setThemeMode,
                        onMotionEnabledChange = application.container.appearance::setMotionEnabled,
                        onSceneEnabledChange = application.container.appearance::setSceneEnabled,
                        onSceneQualityChange = application.container.appearance::setSceneQuality,
                        onReplayBoot = { bootVisible = true },
                    )
                },
            )
                }
            }
            }
        }
        composable("log") {
            LogScreen(
                title = logPayload.title,
                content = logPayload.content,
                onBack = { navController.popBackStack() },
                onCopy = { application.container.events.emit(UiEffect.CopyText(logPayload.content)) },
                onExport = {
                    withStorageAccess(RhineStorageAction.EXPORT_LOG)
                },
            )
        }
    }

    if (localCustomizerState.visible) {
        LocalCustomizerDialog(
            state = localCustomizerState,
            onDismiss = localCustomizerViewModel::dismiss,
            onPackageNameChange = localCustomizerViewModel::setPackageName,
            onManagerNameChange = localCustomizerViewModel::setManagerName,
            onPickIcon = localCustomizerViewModel::requestIcon,
            onUseDefaultIcon = localCustomizerViewModel::useDefaultIcon,
            onBuildAndInstall = localCustomizerViewModel::buildAndInstall,
            onExport = localCustomizerViewModel::buildAndExport,
        )
    }

    if (mainState.rootConfig.visible) {
        RootConfigDialog(
            state = mainState.rootConfig,
            onDismiss = mainViewModel::dismissRootConfig,
            onRootKeyChange = mainViewModel::updateRootKey,
            onModeChange = mainViewModel::updateMode,
            onImport = { withStorageAccess(RhineStorageAction.IMPORT_HOTLOAD) },
            onExport = { withStorageAccess(RhineStorageAction.EXPORT_HOTLOAD) },
            onConfirm = mainViewModel::saveRootConfig,
            startup = !rhineSession.bootCompleted.value && mainState.activeRootKey.isBlank() && !basicManagement,
        )
    } else if (mainState.rootConfig.busy) {
        BusyDialog("正在加载热启动补丁，预计需要 1 分钟…")
    }

    if (missingAppListPermission) {
        AlertDialog(
            onDismissRequest = {},
            icon = { Icon(Icons.Outlined.Apps, null) },
            title = { Text("需要应用列表权限") },
            text = { Text("请授予读取应用列表权限，然后重新打开管理器。") },
            confirmButton = { Button(onClick = { missingAppListPermission = false; activity.finish() }) { Text("确定") } },
        )
    }
    if (bootVisible) {
        TerminalBootOverlay(onDismiss = { bootVisible = false })
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AdaptiveMainScreen(
    selectedPage: Int,
    onPageSelected: (Int) -> Unit,
    snackbarHostState: SnackbarHostState,
    motionEnabled: Boolean,
    contentActive: Boolean,
    home: @Composable (PaddingValues) -> Unit,
    superUser: @Composable (PaddingValues) -> Unit,
    modules: @Composable (PaddingValues) -> Unit,
    settings: @Composable (PaddingValues) -> Unit,
) {
    val pagerState = rememberPagerState(initialPage = selectedPage, pageCount = { 4 })
    val animationsAllowed = rememberTerminalMotionEnabled() && motionEnabled
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
                    animationSpec = tween(durationMillis = if (animationsAllowed) 260 else 0, easing = FastOutSlowInEasing),
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
                    TerminalNavigation(items = navigationItems, selectedIndex = navigationPage, onSelect = ::navigateToPage, vertical = true)
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.weight(1f),
                        beyondViewportPageCount = 3,
                    ) { page ->
                        CompositionLocalProvider(LocalMotionActive provides (contentActive && page == pagerState.currentPage && !pagerState.isScrollInProgress)) {
                            MainPage(page, PaddingValues(0.dp), home, superUser, modules, settings)
                        }
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
        } else {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                bottomBar = {
                    TerminalNavigation(items = navigationItems, selectedIndex = navigationPage, onSelect = ::navigateToPage)
                },
                containerColor = Color.Transparent,
            ) { outerPadding ->
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                    beyondViewportPageCount = 3,
                ) { page ->
                    CompositionLocalProvider(LocalMotionActive provides (contentActive && page == pagerState.currentPage && !pagerState.isScrollInProgress)) {
                        MainPage(page, outerPadding, home, superUser, modules, settings)
                    }
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

private fun hasStorageAccess(context: Context): Boolean = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> Environment.isExternalStorageManager()
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
    else -> true
}

private fun canRequestPackageInstalls(context: Context): Boolean =
    context.packageManager.canRequestPackageInstalls()

private suspend fun commitLocalInstall(
    context: Context,
    request: PendingLocalInstall,
    resultAction: String,
) = withContext(Dispatchers.IO) {
    require(request.file.isFile) { "待安装 APK 不存在" }
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
        setAppPackageName(request.packageName)
        setSize(request.file.length())
    }
    var sessionId = -1
    try {
        sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("base.apk", 0, request.file.length()).use { output ->
                request.file.inputStream().use { input -> input.copyTo(output) }
                session.fsync(output)
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val resultIntent = Intent(resultAction).setPackage(context.packageName)
            val pendingResult = PendingIntent.getBroadcast(context, sessionId, resultIntent, flags)
            session.commit(pendingResult.intentSender)
        }
    } catch (error: Throwable) {
        if (sessionId >= 0) runCatching { installer.abandonSession(sessionId) }
        throw error
    }
}

@Suppress("DEPRECATION")
private fun Intent.packageInstallerConfirmationIntent(): Intent? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
    } else {
        getParcelableExtra(Intent.EXTRA_INTENT)
    }

private fun packageInstallerStatusText(status: Int): String = when (status) {
    PackageInstaller.STATUS_FAILURE_ABORTED -> "用户取消了安装"
    PackageInstaller.STATUS_FAILURE_BLOCKED -> "系统阻止了安装"
    PackageInstaller.STATUS_FAILURE_CONFLICT -> "与已安装应用冲突"
    PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "APK 与当前设备不兼容"
    PackageInstaller.STATUS_FAILURE_INVALID -> "APK 无效"
    PackageInstaller.STATUS_FAILURE_STORAGE -> "存储空间不足"
    else -> "系统安装器返回状态 $status"
}
