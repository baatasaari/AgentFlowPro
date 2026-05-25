// Global test setup — runs before all tests
import { vi } from "vitest";

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://afptest:afptest123@localhost:5432/agentflowpro_test";
process.env.JWT_SECRET = "test-jwt-secret-32-chars-minimum!!";
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
process.env.NODE_ENV = "test";
process.env.CONNECTOR_ENCRYPTION_KEY = "dGVzdC1rZXktMzItYnl0ZXMtZm9yLWFlcy0yNTY="; // 32 bytes base64

// Suppress console.error in tests unless TEST_VERBOSE is set
if (!process.env.TEST_VERBOSE) {
  vi.spyOn(console, "error").mockImplementation(() => {});
}
