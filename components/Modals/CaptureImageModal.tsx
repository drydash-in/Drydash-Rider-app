import {
  CameraView,
  useCameraPermissions
} from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onCancel: () => void;
  onImageCaptured: (uri: string) => void;
  skipCapture: () => void;
  allowSkip?: boolean;
}

export default function CaptureImageModal({
  visible,
  onCancel,
  skipCapture,
  onImageCaptured,
  allowSkip = true,
}: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7,
    });

    setPhotoUri(photo.uri);
  };

  if (!permission?.granted) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.permissionWrap}>
          <Text style={{ color: "#fff", marginBottom: 12 }}>
            Camera permission is required
          </Text>
          <TouchableOpacity onPress={requestPermission}>
            <Text style={{ color: "#22C55E", fontWeight: "800" }}>
              Allow Camera
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {!photoUri ? (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={"back"}
            />

            <View style={styles.actions}>
              <TouchableOpacity onPress={onCancel}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>

              {allowSkip ? (
                <TouchableOpacity onPress={() => skipCapture()}>
                  <Text style={styles.cancel}>Skip Capture</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.skipPlaceholder} />
              )}

              <TouchableOpacity
                style={styles.captureBtn}
                onPress={takePicture}
              />
            </View>
          </>
        ) : (
          <>
            <Image source={{ uri: photoUri }} style={styles.preview} />

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setPhotoUri(null)}
              >
                <Text>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onImageCaptured(photoUri);
                  setPhotoUri(null);
                }}
              >
                <Text style={styles.uploadText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  actions: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
  },
  cancel: {
    color: "#fff",
    fontSize: 16,
  },
  skipPlaceholder: {
    width: 96,
  },
  preview: {
    flex: 1,
    resizeMode: "contain",
  },
  previewActions: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  secondaryBtn: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtn: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  uploadText: {
    color: "#000",
    fontWeight: "900",
  },
  permissionWrap: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
