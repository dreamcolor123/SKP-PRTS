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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
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
import com.linux.permissionmanager.data.ManagerUiMode
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import com.linux.permissionmanager.ui.legacy.LegacyMainScreen
import com.linux.permissionmanager.ui.legacy.theme.SkpTheme as LegacyTheme
import com.linux.permissionmanager.ui.legacy.theme.AppearanceBackground as LegacyBackground
import com.linux.permissionmanager.ui.legacy.screens.HomeScreen as LegacyHomeScreen
import com.linux.permissionmanager.ui.legacy.screens.SuperUserScreen as LegacySuperUserScreen
import com.linux.permissionmanager.ui.legacy.screens.ModuleScreen as LegacyModuleScreen
import com.linux.permissionmanager.ui.legacy.screens.SettingsScreen as LegacySettingsScreen
import com.linux.permissionmanager.ui.legacy.screens.RootConfigDialog as LegacyRootConfigDialog
import com.linux.permissionmanager.ui.legacy.screens.LogScreen as LegacyLogScreen
import com.linux.permissionmanager.ui.legacy.screens.LocalCustomizerDialog as LegacyLocalCustomizerDialog
import com.linux.permissionmanager.data.UiEffect
import com.linux.permissionmanager.ui.*
import com.linux.permissionmanager.ui.rhine.*
import com.linux.permissionmanager.ui.motion.rememberSystemMotionEnabled
import com.linux.permissionmanager.ui.screens.*
import com.linux.permissionmanager.ui.theme.SkpTheme
import com.linux.permissionmanager.ui.startup.StartupRootContent
import com.linux.permissionmanager.utils.FileUtils
import com.linux.permissionmanager.utils.GetAppListPermissionHelper
import com.linux.permissionmanager.utils.ModuleWebUiShortcut
import com.linux.permissionmanager.utils.UrlIntentUtils
import kotlinx.coroutines.Dispatchers
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

    val mode by application.container.managerUi.mode.collectAsStateWithLifecycle()
    val chosen = mode
    if (chosen == null) {
        SkpTheme(appearance) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                ManagerUiChoice(application.container.managerUi::select)
            }
        }
    } else {
        SkpApp(application, appearance, { backgroundPicker.launch(arrayOf("image/*")) }, chosen)
    }
}

internal data class PendingLocalInstall(
    val file: File,
    val packageName: String,
)

@Composable
private fun SkpApp(
    application: PermissionManagerApplication,
    appearance: AppearanceSettings,
    onPickBackground: () -> Unit,
    uiMode: ManagerUiMode,
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
    var logPayload by rhineSession.logPayload
    var pendingRunOnce by rhineSession.pendingRunOnce
    var pendingStorageAction by rhineSession.pendingStorage
    var missingAppListPermission by remember { mutableStateOf(!GetAppListPermissionHelper.getPermissions(activity)) }
    var pendingExport by rhineSession.pendingExport
    var pendingInstall by rhineSession.pendingInstall
    val glassHazeState = remember { HazeState() }
    val overlayState: RhineOverlayViewModel = viewModel()
    val latestMode by rememberUpdatedState(uiMode)
    val currentEntry by navController.currentBackStackEntryAsState()
    val systemMotionEnabled = rememberSystemMotionEnabled()
    val startupRoot = mainState.rootConfig.visible && mainState.activeRootKey.isBlank() && !rhineSession.rootEntryCompleted.value
    LaunchedEffect(mainState.rootConfig.visible) {
        if (!mainState.rootConfig.visible) rhineSession.rootEntryCompleted.value = true
    }
    val installResultAction = remember(context.packageName) { "${context.packageName}.LOCAL_INSTALL_RESULT" }

    val switchBlocked = mainState.rootConfig.visible || mainState.rootConfig.busy || localCustomizerState.visible ||
        homeState.busyAction != null || superUserState.busy || superUserState.pickerVisible ||
        moduleState.busy || moduleState.download != null || settingsState.busyItem != null ||
        pendingStorageAction != null || pendingExport != null || pendingInstall != null
    val latestSwitchBlocked by rememberUpdatedState(switchBlocked)

    fun changeUi(target: ManagerUiMode, failure: Boolean = false): Boolean {
        if (latestMode == target) return true
        if (application.container.managerUi.mode.value != latestMode) return false
        if (!failure && latestSwitchBlocked) return false
        val saved = if (failure) application.container.managerUi.fallbackToLegacy()
            else application.container.managerUi.select(target)
        if (!saved && !failure) {
            scope.launch { snackbarHostState.showSnackbar("无法保存界面选择，请重试") }
            return false
        }
        overlayState.clear()
        superUserViewModel.hidePicker()
        rhineSession.sensorEnabled.value = false
        rhineSession.rendererError.value = null
        rhineSession.rendererGeneration.value++
        if (target == ManagerUiMode.RHINE) {
            rhineSession.bootTime.value = 35.0
            rhineSession.bootCompleted.value = true
        } else mainViewModel.selectPage(0)
        if (navController.currentDestination?.route != "main") navController.popBackStack("main", false)
        if (failure) scope.launch {
            snackbarHostState.showSnackbar(if (saved) "新版界面载入失败，已切换旧版 UI" else "已临时切换旧版 UI，但界面偏好保存失败")
        }
        return true
    }

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
        rhineSession.workspace.value = org.json.JSONObject().put("section", "modules")
            .put("recordId", "module:$moduleId").put("root", false).put("browsing", false).toString()
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

    val content: @Composable () -> Unit = {
    NavHost(navController = navController, startDestination = "main") {
        composable("main") {
    if (startupRoot) {
        Box(Modifier.fillMaxSize()) {
            StartupRootContent(
                state = mainState.rootConfig,
                onDismiss = mainViewModel::dismissRootConfig,
                onRootKeyChange = mainViewModel::updateRootKey,
                onModeChange = mainViewModel::updateMode,
                onImport = { withStorageAccess(RhineStorageAction.IMPORT_HOTLOAD) },
                onExport = { withStorageAccess(RhineStorageAction.EXPORT_HOTLOAD) },
                onConfirm = mainViewModel::saveRootConfig,
            )
            SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter).safeDrawingPadding().imePadding().padding(bottom = 96.dp))
        }
    } else if (uiMode == ManagerUiMode.RHINE) {
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
                        uiMode = uiMode,
                        switchAllowed = !switchBlocked,
                        onUiModeChange = { changeUi(it) },
                        onRendererFailure = { if (latestMode == ManagerUiMode.RHINE) changeUi(ManagerUiMode.LEGACY, failure = true) },
                        overlays = overlayState,
                    )
                    SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter).navigationBarsPadding())
                }
            } else {
            LegacyMainScreen(
                selectedPage = mainState.selectedPage,
                onPageSelected = mainViewModel::selectPage,
                snackbarHostState = snackbarHostState,
                glassNavigationEnabled = appearance.glassNavigationEnabled,
                glassNavigationTransparency = appearance.glassNavigationTransparency,
                glassHazeState = glassHazeState,
                home = {
                    LegacyHomeScreen(
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
                    LegacySuperUserScreen(
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
                    LegacyModuleScreen(
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
                    LegacySettingsScreen(
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
                        onResetAppearance = application.container.appearance::resetLegacy,
                        onOpenLocalCustomizer = localCustomizerViewModel::show,
                        uiMode = uiMode.key,
                        onUiModeChange = { key -> ManagerUiMode.fromKey(key)?.let { changeUi(it) } },
                        uiModeSwitchAllowed = !switchBlocked,
                    )
                },
            )
            }
        }
        composable("log") {
            if (uiMode == ManagerUiMode.LEGACY) LegacyLogScreen(
                title = logPayload.title,
                content = logPayload.content,
                onBack = { navController.popBackStack() },
                onCopy = { application.container.events.emit(UiEffect.CopyText(logPayload.content)) },
                onExport = { withStorageAccess(RhineStorageAction.EXPORT_LOG) },
            ) else LogScreen(
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
        if (uiMode == ManagerUiMode.LEGACY) LegacyLocalCustomizerDialog(
            state = localCustomizerState,
            onDismiss = localCustomizerViewModel::dismiss,
            onPackageNameChange = localCustomizerViewModel::setPackageName,
            onManagerNameChange = localCustomizerViewModel::setManagerName,
            onPickIcon = localCustomizerViewModel::requestIcon,
            onUseDefaultIcon = localCustomizerViewModel::useDefaultIcon,
            onBuildAndInstall = localCustomizerViewModel::buildAndInstall,
            onExport = localCustomizerViewModel::buildAndExport,
        ) else LocalCustomizerDialog(
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

    if (mainState.rootConfig.visible && !startupRoot) {
        if (uiMode == ManagerUiMode.LEGACY) LegacyRootConfigDialog(
            state = mainState.rootConfig,
            onDismiss = mainViewModel::dismissRootConfig,
            onRootKeyChange = mainViewModel::updateRootKey,
            onModeChange = mainViewModel::updateMode,
            onImport = { withStorageAccess(RhineStorageAction.IMPORT_HOTLOAD) },
            onExport = { withStorageAccess(RhineStorageAction.EXPORT_HOTLOAD) },
            onConfirm = mainViewModel::saveRootConfig,
        ) else RootConfigDialog(
            state = mainState.rootConfig,
            onDismiss = mainViewModel::dismissRootConfig,
            onRootKeyChange = mainViewModel::updateRootKey,
            onModeChange = mainViewModel::updateMode,
            onImport = { withStorageAccess(RhineStorageAction.IMPORT_HOTLOAD) },
            onExport = { withStorageAccess(RhineStorageAction.EXPORT_HOTLOAD) },
            onConfirm = mainViewModel::saveRootConfig,
        )
    } else if (mainState.rootConfig.busy && !startupRoot) {
        if (uiMode == ManagerUiMode.LEGACY) com.linux.permissionmanager.ui.legacy.screens.BusyDialog("正在加载热启动补丁，预计需要 1 分钟…")
        else BusyDialog("正在加载热启动补丁，预计需要 1 分钟…")
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
    }
    if (uiMode == ManagerUiMode.LEGACY && !startupRoot) {
        LegacyTheme(appearance) {
            LegacyBackground(appearance,
                backgroundModifier = if (appearance.glassNavigationEnabled) Modifier.hazeSource(glassHazeState, zIndex = 0f) else Modifier,
                onImageError = {
                    if (appearance.backgroundEnabled) {
                        application.container.appearance.clearBackground()
                        application.container.events.emit(UiEffect.Snackbar("背景图片读取失败，已恢复纯色背景"))
                    }
                },
            ) { content() }
        }
    } else {
        SkpTheme(appearance) {
            // Paint behind safeDrawingPadding and transparent system bars as the theme changes.
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { content() }
        }
    }
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
