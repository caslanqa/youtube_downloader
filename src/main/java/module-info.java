module com.caslanqa.ytdownload {
    requires javafx.controls;
    requires javafx.fxml;
    requires java.desktop;

    requires org.controlsfx.controls;
    requires org.kordamp.ikonli.javafx;
    requires org.kordamp.bootstrapfx.core;

    opens com.caslanqa.ytdownload to javafx.fxml;
    exports com.caslanqa.ytdownload;
}