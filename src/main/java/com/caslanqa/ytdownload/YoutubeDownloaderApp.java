package com.caslanqa.ytdownload;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.stage.Stage;

import java.io.IOException;

public class YoutubeDownloaderApp extends Application {
    @Override
    public void start(Stage stage) throws IOException {
        FXMLLoader fxmlLoader = new FXMLLoader(YoutubeDownloaderApp.class.getResource("ytdownloader.fxml"));
        Scene scene = new Scene(fxmlLoader.load());
        stage.setTitle("Youtube Downloader");
        stage.setScene(scene);
        stage.show();
    }
}
