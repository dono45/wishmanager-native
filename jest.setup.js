// Mock expo modules
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    closeSync: jest.fn(),
    withTransactionSync: jest.fn((fn) => fn()),
  })),
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
}));

jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/documents/",
  copyAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
}));

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn(() => Promise.resolve("mockhash")),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

// Mock react-native-vector-icons (jest-expo maps it to @expo/vector-icons)
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "Icon", { virtual: true });

// Silence console during tests unless explicitly needed
// global.console = {
//   ...console,
//   log: jest.fn(),
// };
