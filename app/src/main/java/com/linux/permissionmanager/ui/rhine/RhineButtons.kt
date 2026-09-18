package com.linux.permissionmanager.ui.rhine

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape

/** Native inputs share the reference's square control silhouette. */
@Composable
fun RhineButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = RectangleShape, colors: ButtonColors = ButtonDefaults.buttonColors(),
    border: BorderStroke? = null, contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit) {
    Button(onClick, modifier, enabled, shape, colors, border = border, contentPadding = contentPadding, content = content)
}

@Composable
fun RhineOutlinedButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = RectangleShape, colors: ButtonColors = ButtonDefaults.outlinedButtonColors(),
    border: BorderStroke? = ButtonDefaults.outlinedButtonBorder(enabled), contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit) {
    OutlinedButton(onClick, modifier, enabled, shape, colors, border = border, contentPadding = contentPadding, content = content)
}

@Composable
fun RhineTonalButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = RectangleShape, colors: ButtonColors = ButtonDefaults.filledTonalButtonColors(),
    border: BorderStroke? = null, contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit) {
    FilledTonalButton(onClick, modifier, enabled, shape, colors, border = border, contentPadding = contentPadding, content = content)
}

@Composable
fun RhineTextButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = RectangleShape, colors: ButtonColors = ButtonDefaults.textButtonColors(),
    border: BorderStroke? = null, contentPadding: PaddingValues = ButtonDefaults.TextButtonContentPadding,
    content: @Composable RowScope.() -> Unit) {
    TextButton(onClick, modifier, enabled, shape, colors, border = border, contentPadding = contentPadding, content = content)
}
