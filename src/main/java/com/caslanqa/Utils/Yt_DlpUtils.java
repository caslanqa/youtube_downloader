package com.caslanqa.Utils;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.function.Consumer;

public class Yt_DlpUtils {

    public static boolean downloadAsMp3(String playlistUrl, String outputDir, Consumer<Double> progressCallback) {
        try {
            String[] command = {
                    "yt-dlp",
                    "-x",
                    "-f", "bestaudio",
                    "--audio-format", "mp3",
                    "-o", outputDir + "/%(title)s.%(ext)s",
                    playlistUrl
            };

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("Downloading item")||line.contains("Extracting URL")) {
                    System.out.println(line);
                }
                if (line.contains("[download]")) {
                    Double percent = parseProgress(line);
                    if (percent != null && progressCallback != null) {
                        progressCallback.accept(percent / 100.0);
                    }
                }
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            installYtDlp(e);
            return downloadAsMp3(playlistUrl, outputDir, progressCallback);
        }
    }

    public static boolean downloadAsVideoMp4(String playlistUrl, String outputDir, Consumer<Double> progressCallback) {
        try {
            String[] command = {
                    "yt-dlp",
                    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
                    "--merge-output-format", "mp4",
                    "-o", outputDir + "/%(title)s.%(ext)s",
                    playlistUrl
            };


            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("[download]")) {
                    Double percent = parseProgress(line);
                    if (percent != null && progressCallback != null) {
                        progressCallback.accept(percent / 100.0);
                    }
                }
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            installYtDlp(e);
            return downloadAsVideoMp4(playlistUrl, outputDir, progressCallback);
        }
    }

    public static boolean downloadAsVideoWebm(String playlistUrl, String outputDir, Consumer<Double> progressCallback) {
        try {
            String[] command = {
                    "yt-dlp",
                    "-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]",
                    "-o", outputDir + "/%(title)s.%(ext)s",
                    playlistUrl
            };

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("[download]")) {
                    Double percent = parseProgress(line);
                    if (percent != null && progressCallback != null) {
                        progressCallback.accept(percent / 100.0);
                    }
                }
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            installYtDlp(e);
            return downloadAsVideoWebm(playlistUrl, outputDir, progressCallback);
        }
    }

    private static boolean installYtDlp(Exception e) {
        try {
            if (e.getMessage().contains("Cannot run program \"yt-dlp\"")) {
                String os = System.getProperty("os.name").toLowerCase();
                String[] installCmd = os.contains("win") ? new String[]{"pip", "install", "-U", "yt-dlp"} : new String[]{"pip3", "install", "-U", "yt-dlp"};

                Process installProcess = Runtime.getRuntime().exec(installCmd);
                installProcess.waitFor();
            }
            return true;
        } catch (Exception ex) {
            Alerts.showErrorAlert("An error occurred during yt-dlp installation: " + ex.getMessage());
            return false;
        }
    }

    private static Double parseProgress(String line) {
        // Example line: [download]  42.3% of ...
        int idx = line.indexOf("% of");
        if (idx > 0) {
            String sub = line.substring(0, idx);
            int start = sub.lastIndexOf("[");
            if (start >= 0) {
                String percentStr = sub.substring(sub.lastIndexOf(" ") + 1).replace("%", "").trim();
                try {
                    return Double.parseDouble(percentStr);
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }

}
