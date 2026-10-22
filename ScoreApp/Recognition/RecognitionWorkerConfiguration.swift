import Foundation
import Security

struct RecognitionWorkerConfiguration: Codable, Sendable {
    let baseURL: URL
    let bearerToken: String

    init(address: String, token: String) throws {
        let address = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: address), url.scheme?.lowercased() == "https",
              let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil else {
            throw WorkerConfigurationError.invalidAddress
        }
        let token = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty, !token.contains(where: \.isWhitespace) else {
            throw WorkerConfigurationError.invalidToken
        }
        baseURL = url
        bearerToken = token
    }
}

enum WorkerConfigurationError: LocalizedError {
    case invalidAddress
    case invalidToken
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidAddress:
            return "Enter an HTTPS worker address without embedded credentials, a query or a fragment."
        case .invalidToken:
            return "Enter the worker access token without spaces."
        case .keychain(let status):
            return SecCopyErrorMessageString(status, nil) as String?
                ?? "The worker connection could not be saved in Keychain (\(status))."
        }
    }
}

/// The endpoint and credential are one Keychain item, separate from score files.
struct RecognitionWorkerConfigurationStore {
    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "org.scoreprep.recognition-worker",
            kSecAttrAccount as String: "primary"
        ]
    }

    func load() throws -> RecognitionWorkerConfiguration? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw WorkerConfigurationError.keychain(status) }
        guard let data = item as? Data else { throw WorkerConfigurationError.keychain(errSecDecode) }
        return try JSONDecoder().decode(RecognitionWorkerConfiguration.self, from: data)
    }

    func save(_ configuration: RecognitionWorkerConfiguration) throws {
        let data = try JSONEncoder().encode(configuration)
        let attributes = [kSecValueData as String: data]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw WorkerConfigurationError.keychain(status) }
    }

    func remove() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw WorkerConfigurationError.keychain(status)
        }
    }
}
