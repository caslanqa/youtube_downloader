package com.caslanqa.Utils;

import javafx.scene.control.Alert;

public class Alerts {
    public static void showErrorAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle("Download Error");
        alert.setHeaderText("Download Failed!!!");
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void showInfoAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle("Download Process Information");
        alert.setHeaderText("Download Successful!!!");
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void showTypeWarningAlert() {
        Alert alert = new Alert(Alert.AlertType.WARNING);
        alert.setTitle("Invalid Output Type");
        alert.setHeaderText("Invalid Output Type");
        alert.setContentText("Please select a valid output type (MP3, MP4, or WEBM).");
        alert.showAndWait();
    }
}
