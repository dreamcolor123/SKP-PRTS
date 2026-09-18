package com.linux.permissionmanager.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.linux.permissionmanager.data.EnvironmentInfo
import com.linux.permissionmanager.data.EnvironmentState
import com.linux.permissionmanager.data.SystemStatus
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.SuGrant
import com.linux.permissionmanager.ui.screens.HomeScreen
import com.linux.permissionmanager.ui.screens.ModuleScreen
import com.linux.permissionmanager.ui.screens.RootConfigDialog
import com.linux.permissionmanager.ui.screens.SuperUserScreen
import com.linux.permissionmanager.ui.screens.LogScreen
import com.linux.permissionmanager.ui.screens.LocalCustomizerDialog
import com.linux.permissionmanager.ui.theme.SkpTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ComposeScreensTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun homeShowsEnvironmentStatusAndConsole() {
        compose.setContent {
            SkpTheme(appearance = AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                HomeScreen(
                    state = HomeUiState(
                        loading = false,
                        environment = EnvironmentInfo(
                            state = EnvironmentState.RUNNING,
                            installedVersion = "4.5.3",
                            sdkVersion = "35",
                        ),
                        system = SystemStatus(selinux = 0, seccomp = 2, adbEnabled = false),
                        console = "uid=0(root)",
                    ),
                    bottomPadding = PaddingValues(0.dp),
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
        }

        compose.onNodeWithText("正常运行").assertExists()
        compose.onNodeWithText("核心 4.5.3").assertExists()
    }

    @Test
    fun rootDialogUpdatesModeKeyAndConfirmAction() {
        var state by mutableStateOf(RootConfigUiState(visible = true))
        var confirmed = false
        compose.setContent {
            SkpTheme {
                RootConfigDialog(
                    state = state,
                    onDismiss = {},
                    onRootKeyChange = { state = state.copy(rootKey = it) },
                    onModeChange = { state = state.copy(hotload = it) },
                    onImport = {},
                    onExport = {},
                    onConfirm = { confirmed = true },
                )
            }
        }

        compose.onNodeWithText("热启动").performClick()
        compose.onNode(hasSetTextAction()).performTextInput("test-key")
        compose.onNodeWithText("从 1.h 导入").assertExists()
        compose.onNodeWithText("确定").performClick()

        compose.runOnIdle {
            assertTrue(state.hotload)
            assertEquals("test-key", state.rootKey)
            assertTrue(confirmed)
        }
    }

    @Test
    fun authorizationEmptyStateCanOpenAppPicker() {
        var pickerVisible by mutableStateOf(false)
        compose.setContent {
            SkpTheme {
                SuperUserScreen(
                    state = SuperUserUiState(loading = false, pickerVisible = pickerVisible),
                    bottomPadding = PaddingValues(0.dp),
                    onRefresh = {},
                    onSearch = {},
                    onShowPicker = { pickerVisible = true },
                    onHidePicker = { pickerVisible = false },
                    onPickerSearch = {},
                    onFilterSystem = {},
                    onFilterThirdParty = {},
                    onAdd = {},
                    onAddAdb = {},
                    onRemove = {},
                    onClear = {},
                )
            }
        }

        compose.onNodeWithText("暂无 SU 授权").assertExists()
        compose.onNodeWithContentDescription("添加").performClick()
        compose.onNodeWithText("添加 SU 授权").performClick()
        compose.onNodeWithText("选择应用").assertExists()
        compose.runOnIdle { assertTrue(pickerVisible) }
    }

    @Test
    fun moduleTabsSwitchBetweenInstalledAndMarketEmptyStates() {
        var selectedTab by mutableStateOf(0)
        compose.setContent {
            SkpTheme {
                ModuleScreen(
                    state = ModuleUiState(
                        selectedTab = selectedTab,
                        installedLoading = false,
                        marketLoading = false,
                    ),
                    bottomPadding = PaddingValues(0.dp),
                    onSelectTab = { selectedTab = it },
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
        }

        compose.onNodeWithText("暂无已安装模块").assertExists()
        compose.onNodeWithText("模块市场").performClick()
        compose.onNodeWithText("没有匹配的模块").assertExists()
        compose.runOnIdle {
            assertEquals(1, selectedTab)
            assertFalse(selectedTab == 0)
        }
    }

    @Test
    fun rootBusyStateDisablesKeyModeAndConfirmation() {
        compose.setContent {
            SkpTheme {
                RootConfigDialog(
                    state = RootConfigUiState(visible = true, busy = true),
                    onDismiss = {},
                    onRootKeyChange = {},
                    onModeChange = {},
                    onImport = {},
                    onExport = {},
                    onConfirm = {},
                )
            }
        }
        compose.onNodeWithText("Root Key").assertIsNotEnabled()
        compose.onNodeWithText("Boot").assertIsNotEnabled()
        compose.onNodeWithText("热启动").assertIsNotEnabled()
        compose.onNodeWithText("确定").assertIsNotEnabled()
        compose.onNodeWithText("取消").assertIsNotEnabled()
    }

    @Test
    fun authorizationRemovalRequiresConfirmationAndFiresOnce() {
        val grant = SuGrant(packageName = "com.example.fixture", label = "测试应用", icon = null)
        var removals = 0
        compose.setContent {
            SkpTheme {
                SuperUserScreen(
                    state = SuperUserUiState(loading = false, grants = listOf(grant)),
                    bottomPadding = PaddingValues(0.dp),
                    onRefresh = {},
                    onSearch = {},
                    onShowPicker = {},
                    onHidePicker = {},
                    onPickerSearch = {},
                    onFilterSystem = {},
                    onFilterThirdParty = {},
                    onAdd = {},
                    onAddAdb = {},
                    onRemove = { assertEquals(grant, it); removals++ },
                    onClear = {},
                )
            }
        }
        compose.onNodeWithContentDescription("移除").performClick()
        compose.onNodeWithText("移除授权？").assertExists()
        compose.runOnIdle { assertEquals(0, removals) }
        compose.onNodeWithText("移除").performClick()
        compose.onNodeWithText("移除授权？").assertDoesNotExist()
        compose.runOnIdle { assertEquals(1, removals) }
    }

    @Test
    fun reducedMotionLogPreservesRawTextAndEveryCommand() {
        var raw by mutableStateOf("line 01\n中文原始记录 / 0x4A\n\tlast line\n")
        var copies = 0
        var exports = 0
        var backs = 0
        compose.setContent {
            SkpTheme(appearance = AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                LogScreen(
                    title = "测试日志",
                    content = raw,
                    onBack = { backs++ },
                    onCopy = { copies++ },
                    onExport = { exports++ },
                )
            }
        }
        compose.onNodeWithTag("log-content").assertTextEquals(raw)
        compose.onNodeWithContentDescription("复制").performClick()
        compose.onNodeWithContentDescription("导出").performClick()
        compose.onNodeWithContentDescription("返回").performClick()
        compose.runOnIdle {
            assertEquals(1, copies)
            assertEquals(1, exports)
            assertEquals(1, backs)
            raw = " \t\n"
        }
        compose.onNodeWithTag("log-content").assertTextEquals(" \t\n")
    }

    @Test
    fun localCustomizerBusyStateDisablesBuildAndExport() {
        compose.setContent {
            SkpTheme {
                LocalCustomizerDialog(
                    state = LocalCustomizerUiState(visible = true, building = true),
                    onDismiss = {},
                    onPackageNameChange = {},
                    onManagerNameChange = {},
                    onPickIcon = {},
                    onUseDefaultIcon = {},
                    onBuildAndInstall = {},
                    onExport = {},
                )
            }
        }
        compose.onNodeWithText("仅导出 APK").assertIsNotEnabled()
        compose.onNodeWithText("构建并安装").assertIsNotEnabled()
        compose.onNodeWithText("包名").assertIsNotEnabled()
        compose.onNodeWithText("管理器名称").assertIsNotEnabled()
        compose.onNodeWithContentDescription("取消构建").assertExists()
    }
}
