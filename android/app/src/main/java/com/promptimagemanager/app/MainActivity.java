package com.promptimagemanager.app;

import com.getcapacitor.BridgeActivity;
import com.promptimagemanager.app.plugins.ImageGallerySaverPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ImageGallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
