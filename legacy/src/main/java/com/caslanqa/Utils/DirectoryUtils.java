package com.caslanqa.Utils;

import java.awt.Desktop;

public class DirectoryUtils {

    public static String createDirectoryIfNotExists(String path) {
        java.io.File directory = new java.io.File(System.getProperty("user.home")+"/yt-dlp/"+path);
        if (!directory.exists()) {
            directory.mkdirs();
        }
        return System.getProperty("user.home")+"/yt-dlp/"+path;
    }

    public static void openDirectory(String path) {
        try {
            Desktop.getDesktop().open(new java.io.File(path));
        } catch (Exception e) {
            Alerts.showErrorAlert("Could not open directory: " + e.getMessage());
        }
    }
}
