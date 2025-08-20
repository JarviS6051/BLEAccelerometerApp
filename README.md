# BLE Accelerometer App

A React Native application for scanning Bluetooth Low Energy (BLE) devices, connecting to accelerometer sensors, and recording/exporting accelerometer data in real-time.

## Features

- 🔍 **BLE Device Scanning**: Discover nearby BLE devices
- 🔗 **Device Connection**: Connect to accelerometer devices
- 📊 **Real-time Data**: View live accelerometer X, Y, Z values
- 📝 **Data Recording**: Capture timestamped accelerometer readings
- 📁 **CSV Export**: Save data as CSV files with share functionality
- 🎮 **Mock Mode**: Test with simulated accelerometer data
- 🎨 **Modern UI**: Dark theme with intuitive interface

## Prerequisites

Before running this app, ensure you have:

- **Node.js** (v18 or higher)
- **React Native CLI** installed globally
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Physical device** or **emulator** with Bluetooth support

## Installation

1. **Clone or download** this project
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **iOS Setup** (macOS only):
   ```bash
   cd ios
   pod install
   cd ..
   ```

## How to Run

### Step 1: Start Metro Bundler

Open a terminal in the project root and run:

```bash
npx react-native start
```

This starts the Metro bundler on port 8081. Keep this terminal running.

### Step 2: Run on Device/Emulator

Open a **new terminal** in the project root and run:

#### For Android:
```bash
npx react-native run-android
```

#### For iOS (macOS only):
```bash
npx react-native run-ios
```

### Step 3: Grant Permissions

When the app launches, grant the required permissions:
- **Bluetooth permissions** (Android 12+)
- **Location permissions** (Android ≤11, required for BLE scanning)

## Usage Guide

### For Real BLE Device (Interview/Production)

1. **Enable Bluetooth** on your device
2. **Tap "Scan"** - scans for 8 seconds automatically
3. **Connect to your device** from the discovered list
4. **Tap "Discover & Log Services"** to find UUIDs
5. **Check Metro console** for service/characteristic UUIDs
6. **Update UUIDs** in `App.tsx`:
   ```tsx
   const ACCEL_SERVICE_UUID = 'YOUR_ACTUAL_SERVICE_UUID';
   const ACCEL_CHAR_UUID = 'YOUR_ACTUAL_CHARACTERISTIC_UUID';
   ```
7. **Restart the app** (shake device → Reload)
8. **Tap "Start Notifications"** to stream accelerometer data
9. **Tap "Start Recording"** to capture data
10. **Tap "Export CSV"** to save/share the data

### For Testing (Sample Device)

1. **Tap "Scan"** - if no devices found, "Sample Accelerometer" appears
2. **Tap the Sample Device** to connect
3. **Tap "Start Notifications"** - see simulated accelerometer values
4. **Tap "Start Recording"** to capture simulated data
5. **Tap "Export CSV"** to save/share

## App Features

### 🔍 Device Scanning
- **Auto-scan**: 8-second automatic scan
- **Manual stop**: Tap "Stop" to end scanning early
- **Device filtering**: Filter by device name prefix
- **Sample device**: Automatically appears if no real devices found

### 📊 Real-time Monitoring
- **Live values**: X, Y, Z accelerometer values update in real-time
- **Data format**: Supports int16 (default) and float32 formats
- **Mock data**: Realistic sine wave simulation for testing

### 📝 Data Recording
- **Start/Stop**: Toggle recording on/off
- **Timestamped**: Each reading includes millisecond timestamp
- **Row counter**: Shows number of recorded data points
- **Clear data**: Reset recorded data

### 📁 CSV Export
- **Automatic formatting**: Proper CSV headers and data
- **File location**: Saved to app Documents directory
- **Share integration**: Opens system share sheet
- **Cross-platform**: Works on both Android and iOS

## Configuration

### UUID Configuration
Update these constants in `App.tsx` for your specific device:

```tsx
const ACCEL_SERVICE_UUID: string | null = 'YOUR_SERVICE_UUID';
const ACCEL_CHAR_UUID: string | null = 'YOUR_CHARACTERISTIC_UUID';
```

### Data Format
Choose the correct format for your device:

```tsx
const PAYLOAD_FORMAT: 'int16' | 'float32' = 'int16'; // or 'float32'
```

### Device Filtering
Filter devices by name prefix:

```tsx
const DEVICE_NAME_PREFIX = 'Accel'; // or '' to show all devices
```

## Troubleshooting

### Common Issues

**Buttons not responding:**
- Shake device → "Reload" to restart
- Check Metro logs for errors

**No devices found:**
- Ensure Bluetooth is enabled
- Check device permissions
- Use "Sample Device" for testing

**Connection fails:**
- Verify device is advertising
- Check device is in range
- Review Metro logs for BLE errors

**CSV export fails:**
- Check file permissions
- Ensure sufficient storage space
- Try sharing via system share sheet

### Development Tips

- **Metro Logs**: Watch terminal for BLE debug information
- **Hot Reload**: Save `App.tsx` → app updates automatically
- **UUID Discovery**: Use "Discover & Log Services" to find device UUIDs
- **Data Format**: Adjust `PAYLOAD_FORMAT` if device uses different format

## File Structure

```
BLEAccelerometerApp/
├── App.tsx                 # Main application component
├── android/                # Android-specific configuration
│   └── app/src/main/
│       └── AndroidManifest.xml  # BLE permissions
├── ios/                    # iOS-specific configuration
│   └── BLEAccelerometerApp/
│       └── Info.plist      # Bluetooth usage descriptions
└── package.json            # Dependencies and scripts
```

## Dependencies

- **react-native-ble-plx**: BLE device communication
- **react-native-fs**: File system operations
- **react-native-permissions**: Permission handling

## Platform Support

- ✅ **Android**: Full BLE support with proper permissions
- ✅ **iOS**: Full BLE support with usage descriptions
- ✅ **Cross-platform**: Consistent behavior across platforms

## License

This project is for educational and interview purposes.

---

**Ready to use!** 🚀 Connect your BLE accelerometer device and start recording data.
