package com.caslanqa.Utils;

import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Yt_DlpUtils {

    public static boolean downloadAsMp3(String playlistUrl, String outputDir) {
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
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            return false;
        }
    }

    public static boolean downloadAsVideoMp4(String playlistUrl, String outputDir) {
        try {
            String[] command = {
                    "yt-dlp",
                    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
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
                if (line.contains("Downloading item")||line.contains("Extracting URL")) {
                    System.out.println(line);
                }
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            return false;
        }

    }

    public static boolean downloadAsVideoWebm(String playlistUrl, String outputDir) {
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
                if (line.contains("Downloading item")||line.contains("Extracting URL")) {
                    System.out.println(line);
                }
            }
            return process.waitFor() == 0;

        } catch (Exception e) {
            return false;
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

}
