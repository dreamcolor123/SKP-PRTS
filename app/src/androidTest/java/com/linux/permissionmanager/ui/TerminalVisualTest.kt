package com.linux.permissionmanager.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.util.Log
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.outlined.Extension
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.EnvironmentInfo
import com.linux.permissionmanager.data.EnvironmentState
import com.linux.permissionmanager.data.InstalledModule
import com.linux.permissionmanager.data.ModuleRunState
import com.linux.permissionmanager.data.SuGrant
import com.linux.permissionmanager.data.SystemStatus
import com.linux.permissionmanager.data.ThemeMode
import com.linux.permissionmanager.ui.components.GlassNavigationItem
import com.linux.permissionmanager.ui.components.TerminalNavigation
import com.linux.permissionmanager.ui.screens.HomeScreen
import com.linux.permissionmanager.ui.screens.LocalCustomizerDialog
import com.linux.permissionmanager.ui.screens.LogScreen
import com.linux.permissionmanager.ui.screens.ModuleScreen
import com.linux.permissionmanager.ui.screens.RootConfigDialog
import com.linux.permissionmanager.ui.screens.SettingsScreen
import com.linux.permissionmanager.ui.screens.SuperUserScreen
import com.linux.permissionmanager.ui.theme.SkpTheme
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Static visual fixtures. No repository, Root command, or installed-device data is consulted. */
@RunWith(AndroidJUnit4::class)
class TerminalVisualTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun homeRunningLight() = home(ThemeMode.LIGHT, EnvironmentState.RUNNING)

    @Test
    fun homeRunningDark() = home(ThemeMode.DARK, EnvironmentState.RUNNING)

    @Test
    fun homeNotInstalledLight() = home(ThemeMode.LIGHT, EnvironmentState.NOT_INSTALLED)

    @Test
    fun settingsLight() = settings(ThemeMode.LIGHT)

    @Test
    fun settingsDark() = settings(ThemeMode.DARK)

    @Test
    fun authorizationsLight() {
        show(ThemeMode.LIGHT) {
            FixtureShell(1) { padding ->
                AuthorizationFixture(
                    padding,
                    listOf(
                        SuGrant("com.example.fixture.terminal", "终端测试应用", null),
                        SuGrant("com.example.fixture.device.monitor", "设备状态监视器 / TEST FIXTURE", null),
                    ),
                )
            }
        }
        compose.onNodeWithText("终端测试应用").assertExists()
        capture("authorizations-light")
    }

    @Test
    fun authorizationsEmptyDark() {
        show(ThemeMode.DARK) {
            FixtureShell(1) { AuthorizationFixture(it, emptyList()) }
        }
        compose.onNodeWithText("暂无 SU 授权").assertExists()
        capture("authorizations-empty-dark")
    }

    @Test
    fun modulesEmptyLight() {
        show(ThemeMode.LIGHT) {
            FixtureShell(2) { ModuleFixture(it, ModuleUiState(installedLoading = false)) }
        }
        compose.onNodeWithText("暂无已安装模块").assertExists()
        capture("modules-empty-light")
    }

    @Test
    fun modulesErrorDark() {
        show(ThemeMode.DARK) {
            FixtureShell(2) { padding ->
                ModuleFixture(
                    padding,
                    ModuleUiState(installedLoading = false, installedError = "TEST FIXTURE / 模块读取失败"),
                )
            }
        }
        compose.onNodeWithText("TEST FIXTURE / 模块读取失败").assertExists()
        compose.onNodeWithText("暂无已安装模块").assertDoesNotExist()
        capture("modules-error-dark")
    }

    @Test
    fun modulesArchiveLight() {
        show(ThemeMode.LIGHT) {
            FixtureShell(2) { padding ->
                ModuleFixture(
                    padding,
                    ModuleUiState(
                        installedLoading = false,
                        installed = listOf(
                            InstalledModule(
                                name = "终端视觉测试模块",
                                description = "TEST FIXTURE / 本地截图测试档案，不执行任何模块命令。",
                                version = "1.0.0",
                                id = "fixture_terminal_module",
                                author = "SKP-PRTS TEST",
                                updateJson = "",
                                minSdk = "26",
                                hasWebUi = true,
                                runState = ModuleRunState.RUNNING,
                            ),
                        ),
                    ),
                )
            }
        }
        compose.onNodeWithText("终端视觉测试模块").assertExists()
        capture("modules-archive-light")
    }

    @Test
    fun rootConfigurationLight() {
        show(ThemeMode.LIGHT) {
            FixtureShell(0) { HomeFixture(it, EnvironmentState.NOT_INSTALLED) }
            RootConfigDialog(
                state = RootConfigUiState(visible = true, hotload = true),
                onDismiss = {},
                onRootKeyChange = {},
                onModeChange = {},
                onImport = {},
                onExport = {},
                onConfirm = {},
            )
        }
        compose.onNodeWithText("Root 密钥配置").assertExists()
        capture("root-configuration-light")
    }

    @Test
    fun localCustomizerDark() {
        show(ThemeMode.DARK) {
            FixtureShell(0) { HomeFixture(it, EnvironmentState.NOT_INSTALLED) }
            LocalCustomizerDialog(
                state = LocalCustomizerUiState(
                    visible = true,
                    packageName = "com.example.fixture.manager",
                    managerName = "SKP-PRTS TEST",
                    defaultPackageName = "com.example.fixture.manager",
                    defaultManagerName = "SKP-PRTS TEST",
                ),
                onDismiss = {},
                onPackageNameChange = {},
                onManagerNameChange = {},
                onPickIcon = {},
                onUseDefaultIcon = {},
                onBuildAndInstall = {},
                onExport = {},
            )
        }
        compose.onNodeWithText("本地定制管理器").assertExists()
        capture("local-customizer-dark")
    }

    @Test
    fun logDark() {
        show(ThemeMode.DARK) {
            LogScreen(
                title = "运行日志",
                content = """
                    [TEST FIXTURE / SYNTHETIC LOG]
                    10:42:00  visual fixture initialized
                    10:42:01  theme = graphite / dark
                    10:42:01  motion = disabled
                    10:42:02  终端日志原文测试
                    10:42:02  no Root operations executed

                    result: fixture complete
                """.trimIndent(),
                onBack = {},
                onCopy = {},
                onExport = {},
            )
        }
        compose.onNodeWithText("运行日志").assertExists()
        capture("log-dark")
    }

    private fun home(theme: ThemeMode, environment: EnvironmentState) {
        show(theme) { FixtureShell(0) { HomeFixture(it, environment) } }
        compose.onNodeWithText(if (environment == EnvironmentState.RUNNING) "正常运行" else "环境未安装").assertExists()
        capture("home-${environment.name.lowercase()}-${theme.name.lowercase()}")
    }

    private fun settings(theme: ThemeMode) {
        val appearance = fixtureAppearance(theme)
        show(theme) {
            FixtureShell(3) { padding ->
                SettingsScreen(
                    state = SettingsUiState(loading = false, sdkVersion = "4.6.2", bootFailProtect = true),
                    appearance = appearance,
                    bottomPadding = padding,
                    onRefresh = {},
                    onBootFailChange = {},
                    onAdbChange = {},
                    onLogChange = {},
                    onUpdateCheckChange = {},
                    onBasicTest = {},
                    onModuleTest = {},
                    onShowLog = {},
                    onClearLog = {},
                    onReboot = { _, _ -> },
                    onOpenUrl = {},
                    onShowChangelog = {},
                    onPaletteChange = {},
                    onPickBackground = {},
                    onBackgroundAlphaChange = {},
                    onChromeTransparencyChange = {},
                    onControlTransparencyChange = {},
                    onGlassNavigationChange = {},
                    onGlassNavigationTransparencyChange = {},
                    onClearBackground = {},
                    onResetAppearance = {},
                    onOpenLocalCustomizer = {},
                )
            }
        }
        compose.onNodeWithText("01 / 显示与动态").assertExists()
        capture("settings-${theme.name.lowercase()}")
    }

    private fun show(theme: ThemeMode, content: @Composable () -> Unit) {
        compose.setContent {
            val context = LocalContext.current
            SideEffect {
                // Match the real activity's edge-to-edge setup in the Compose test activity.
                context.activity()?.window?.let { window ->
                    WindowCompat.setDecorFitsSystemWindows(window, false)
                    @Suppress("DEPRECATION")
                    window.statusBarColor = android.graphics.Color.TRANSPARENT
                    @Suppress("DEPRECATION")
                    window.navigationBarColor = android.graphics.Color.TRANSPARENT
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = theme == ThemeMode.LIGHT
                        isAppearanceLightNavigationBars = theme == ThemeMode.LIGHT
                    }
                }
            }
            SkpTheme(appearance = fixtureAppearance(theme)) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { content() }
            }
        }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.waitForIdleSync()
        android.os.SystemClock.sleep(400)
        val screenshot = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val directory = File(requireNotNull(instrumentation.targetContext.getExternalFilesDir(null)), "visual")
        check(directory.exists() || directory.mkdirs())
        val file = File(directory, "fixture-$name.png")
        try {
            check(screenshot.width > 0 && screenshot.height > 0)
            file.outputStream().use { check(screenshot.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        } finally {
            screenshot.recycle()
        }
        assertTrue(file.isFile && file.length() > 0)
        Log.i("TerminalVisualTest", "TEST FIXTURE screenshot: ${file.absolutePath}")
    }
}

private fun fixtureAppearance(theme: ThemeMode) = AppearanceSettings(
    themeMode = theme,
    sceneEnabled = false,
    motionEnabled = false,
)

private fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.takeUnless { it === this }?.activity()
    else -> null
}

private val fixtureNavigation = listOf(
    GlassNavigationItem("主页", Icons.Filled.Home, Icons.Outlined.Home),
    GlassNavigationItem("授权", Icons.Filled.Shield, Icons.Outlined.Shield),
    GlassNavigationItem("模块", Icons.Filled.Extension, Icons.Outlined.Extension),
    GlassNavigationItem("设置", Icons.Filled.Settings, Icons.Outlined.Settings),
)

@Composable
private fun FixtureShell(selected: Int, content: @Composable (PaddingValues) -> Unit) {
    Scaffold(
        bottomBar = { TerminalNavigation(fixtureNavigation, selected, {}) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding -> content(PaddingValues(bottom = padding.calculateBottomPadding())) }
}

@Composable
private fun HomeFixture(padding: PaddingValues, environment: EnvironmentState) {
    HomeScreen(
        state = HomeUiState(
            loading = false,
            environment = EnvironmentInfo(
                state = environment,
                installedVersion = if (environment == EnvironmentState.RUNNING) "4.6.2" else "-",
                sdkVersion = "4.6.2",
            ),
            system = SystemStatus(selinux = 1, seccomp = 2, adbEnabled = false),
            console = "TEST FIXTURE / No Root commands executed.",
        ),
        bottomPadding = padding,
        onConfigureRoot = {},
        onRefresh = {},
        onInstall = {},
        onUninstall = {},
        onTestRoot = {},
        onRunCommand = {},
        onCopyConsole = {},
        onClearConsole = {},
        onReboot = { _, _ -> },
        onDismissCveSoftRebootPrompt = {},
    )
}

@Composable
private fun AuthorizationFixture(padding: PaddingValues, grants: List<SuGrant>) {
    SuperUserScreen(
        state = SuperUserUiState(loading = false, grants = grants),
        bottomPadding = padding,
        onRefresh = {},
        onSearch = {},
        onShowPicker = {},
        onHidePicker = {},
        onPickerSearch = {},
        onFilterSystem = {},
        onFilterThirdParty = {},
        onAdd = {},
        onAddAdb = {},
        onRemove = {},
        onClear = {},
    )
}

@Composable
private fun ModuleFixture(padding: PaddingValues, state: ModuleUiState) {
    ModuleScreen(
        state = state,
        bottomPadding = padding,
        onSelectTab = {},
        onRefreshInstalled = {},
        onRefreshMarket = {},
        onPickModule = {},
        onOpenGuide = {},
        onMarketQuery = {},
        onRemove = {},
        onDetails = {},
        onWebUi = {},
        onCreateWebUiShortcut = {},
        onCheckUpdate = {},
        onChangelog = {},
        onDownloadUpdate = {},
        onDownloadMarket = {},
        onOpenUrl = {},
        onCancelDownload = {},
    )
}
