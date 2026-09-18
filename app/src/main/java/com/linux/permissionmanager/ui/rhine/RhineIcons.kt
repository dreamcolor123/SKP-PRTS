package com.linux.permissionmanager.ui.rhine

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/** Hand-drawn straight-stroke symbols matching the terminal's arrows and marks. */
object RhineIcons {
    private fun draw(name: String, geometry: String): ImageVector = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        .addPath(PathParser().parsePathString(geometry).toNodes(), fill = null, stroke = SolidColor(Color.Black),
            strokeLineWidth = 1.5f, strokeLineCap = StrokeCap.Square, strokeLineJoin = StrokeJoin.Miter).build()
    val Add = draw("Add", "M12 4V20M4 12H20")
    val Close = draw("Close", "M5 5L19 19M19 5L5 19")
    val Search = draw("Search", "M15 11A5 5 0 1 1 5 11A5 5 0 1 1 15 11M14 15L21 22")
    val Check = draw("Check", "M4 12L9 17L20 6")
    val ArrowBack = draw("Back", "M20 12H4L10 6M4 12L10 18")
    val SaveAlt = draw("Save", "M12 3V16M7 11L12 16L17 11M4 16V21H20V16")
    val FileOpen = draw("File", "M4 21V3H14L20 9V21ZM14 3V9H20M8 13H16M8 17H14")
    val ContentCopy = draw("Copy", "M8 7H20V21H8ZM4 17V3H16")
    val PowerSettingsNew = draw("Power", "M12 2V12M6 5A9 9 0 1 0 18 5")
    val Terminal = draw("Terminal", "M3 4H21V20H3ZM6 8L10 12L6 16M13 16H18")
    val Delete = draw("Delete", "M4 6H20M9 6V3H15V6M6 6V21H18V6M10 10V17M14 10V17")
    val Refresh = draw("Refresh", "M20 4V10H14M20 10A8 8 0 1 0 19 17")
    val Extension = draw("Module", "M3 3H10V10H3ZM14 3H21V10H14ZM3 14H10V21H3ZM14 14H21V21H14Z")
    val Shield = draw("Authorization", "M12 2L21 6V13L18 18L12 22L6 18L3 13V6ZM8 12L11 15L17 9")
    val Info = draw("Info", "M3 3H21V21H3ZM12 10V17M12 6V7")
    val Image = draw("Image", "M3 3H21V21H3ZM4 17L9 12L13 16L17 10L21 15M7 7H9V9H7Z")
    val Language = draw("Web", "M3 12H21M12 3V21M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12M6 5L9 12L6 19M18 5L15 12L18 19")
    val Code = draw("Code", "M8 5L2 12L8 19M16 5L22 12L16 19M14 3L10 21")
    val Visibility = draw("Visibility", "M2 12L7 7H17L22 12L17 17H7ZM15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12")
    val MoreVert = draw("More", "M11 4H13V6H11ZM11 11H13V13H11ZM11 18H13V20H11Z")
    val Science = draw("Diagnostic", "M8 2H16M10 2V10L4 20H20L14 10V2M7 15H17")
    val Android = draw("Manager", "M4 6H20V20H4ZM8 2V6M16 2V6M8 10V12M16 10V12M8 16H16")
    val AddToHomeScreen = draw("Shortcut", "M3 3H15V21H3ZM19 3V13M14 8H24M7 17H11")
    val InstallMobile = AddToHomeScreen
    val SearchOff = Search
    val DeleteForever = Delete
    val DeleteOutline = Delete
    val DeleteSweep = Delete
    val Download = SaveAlt
    val Downloading = SaveAlt
    val SystemUpdate = SaveAlt
    val Update = Refresh
    val ExtensionOff = Extension
    val Apps = Extension
    val Storefront = Extension
    val VerifiedUser = Shield
    val FolderZip = FileOpen
    val Article = FileOpen
    val MenuBook = FileOpen
}
