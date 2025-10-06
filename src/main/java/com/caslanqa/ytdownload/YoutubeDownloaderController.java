package com.caslanqa.ytdownload;

import com.caslanqa.Utils.Alerts;
import com.caslanqa.Utils.DirectoryUtils;
import com.caslanqa.Utils.Yt_DlpUtils;
import javafx.concurrent.Task;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.Background;
import javafx.scene.paint.Paint;
import javafx.scene.text.Font;

public class YoutubeDownloaderController {

    @FXML
    private TextField albumNameField;

    @FXML
    private ImageView imgView;

    @FXML
    private TextField linkPathField;

    @FXML
    private ComboBox<String> outputTypeCB = new ComboBox<>();

    @FXML
    private Label statusDisplay;

    @FXML
    private ProgressBar progressBar;

    @FXML
    private void initialize() {
        imgView.setImage(new Image(getClass().getResource("/icons/ytdownload.png").toExternalForm()));
        outputTypeCB.getItems().addAll("MP3", "MP4","WEBM");
    }

    @FXML
    void downloadBtn(MouseEvent event) {
        String albumName = albumNameField.getText().trim();
        String destinationFolderPath = DirectoryUtils.createDirectoryIfNotExists(albumName);
        download(destinationFolderPath);
        statusDisplay.setText("Download completed. Click to open Destination Folder.");
        statusDisplay.setBackground(Background.fill(Paint.valueOf("06D900")));
        statusDisplay.setTextFill(Paint.valueOf("FF0000"));
        statusDisplay.setOnMouseClicked(e -> DirectoryUtils.openDirectory(destinationFolderPath));
    }

    private void download(String destinationPath){
        String link = linkPathField.getText().trim();
        String outputType = outputTypeCB.getValue();
        String albumName = albumNameField.getText().trim();
        switch (outputType) {
            case "MP3" -> {
                Task<Boolean> downloadTask = new Task<>() {
                    @Override
                    protected Boolean call() {
                        return Yt_DlpUtils.downloadAsMp3(link, destinationPath, progress -> updateProgress(progress, 1.0));
                    }
                };
                progressBar.progressProperty().bind(downloadTask.progressProperty());
                downloadTask.setOnSucceeded(e -> {
                    if (downloadTask.getValue()) {
                        Alerts.showInfoAlert("The album \"" + albumName + "\" has been downloaded successfully in MP3 format.");
                        statusDisplay.setText("Download completed. Click to open Destination Folder.");
                        statusDisplay.setBackground(Background.fill(Paint.valueOf("06D900")));
                        statusDisplay.setTextFill(Paint.valueOf("FF0000"));
                        statusDisplay.setOnMouseClicked(ev -> DirectoryUtils.openDirectory(destinationPath));
                    } else {
                        Alerts.showErrorAlert("Download failed.");
                    }
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                downloadTask.setOnFailed(e -> {
                    Alerts.showErrorAlert("Download failed.");
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                new Thread(downloadTask).start();
            }
            case "MP4" -> {
                Task<Boolean> downloadTask = new Task<>() {
                    @Override
                    protected Boolean call() {
                        return Yt_DlpUtils.downloadAsVideoMp4(link, destinationPath, progress -> updateProgress(progress, 1.0));
                    }
                };
                progressBar.progressProperty().bind(downloadTask.progressProperty());
                downloadTask.setOnSucceeded(e -> {
                    if (downloadTask.getValue()) {
                        Alerts.showInfoAlert("The album \"" + albumName + "\" has been downloaded successfully in MP4 format.");
                        statusDisplay.setText("Download completed. Click to open Destination Folder.");
                        statusDisplay.setBackground(Background.fill(Paint.valueOf("06D900")));
                        statusDisplay.setTextFill(Paint.valueOf("FF0000"));
                        statusDisplay.setOnMouseClicked(ev -> DirectoryUtils.openDirectory(destinationPath));
                    } else {
                        Alerts.showErrorAlert("Download failed.");
                    }
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                downloadTask.setOnFailed(e -> {
                    Alerts.showErrorAlert("Download failed.");
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                new Thread(downloadTask).start();
            }
            case "WEBM" -> {
                Task<Boolean> downloadTask = new Task<>() {
                    @Override
                    protected Boolean call() {
                        return Yt_DlpUtils.downloadAsVideoWebm(link, destinationPath, progress -> updateProgress(progress, 1.0));
                    }
                };
                progressBar.progressProperty().bind(downloadTask.progressProperty());
                downloadTask.setOnSucceeded(e -> {
                    if (downloadTask.getValue()) {
                        Alerts.showInfoAlert("The album \"" + albumName + "\" has been downloaded successfully in WEBM format.");
                        statusDisplay.setText("Download completed. Click to open Destination Folder.");
                        statusDisplay.setBackground(Background.fill(Paint.valueOf("06D900")));
                        statusDisplay.setTextFill(Paint.valueOf("FF0000"));
                        statusDisplay.setOnMouseClicked(ev -> DirectoryUtils.openDirectory(destinationPath));
                    } else {
                        Alerts.showErrorAlert("Download failed.");
                    }
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                downloadTask.setOnFailed(e -> {
                    Alerts.showErrorAlert("Download failed.");
                    progressBar.progressProperty().unbind();
                    progressBar.setProgress(0);
                });
                new Thread(downloadTask).start();
            }
            default -> Alerts.showTypeWarningAlert();
        }
    }

    @FXML
    void closeBtn(MouseEvent event) {
        System.exit(0);
    }

}
