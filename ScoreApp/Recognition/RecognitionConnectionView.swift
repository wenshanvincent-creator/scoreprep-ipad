import SwiftUI

struct RecognitionConnectionView: View {
    let hasConnection: Bool
    let onSave: (RecognitionWorkerConfiguration) throws -> Void
    let onRemove: () throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var address: String
    @State private var token: String
    @State private var errorMessage: String?

    // A newly presented sheet owns this editable copy until Save or Cancel.
    init(
        configuration: RecognitionWorkerConfiguration?,
        onSave: @escaping (RecognitionWorkerConfiguration) throws -> Void,
        onRemove: @escaping () throws -> Void
    ) {
        hasConnection = configuration != nil
        self.onSave = onSave
        self.onRemove = onRemove
        _address = State(initialValue: configuration?.baseURL.absoluteString ?? "")
        _token = State(initialValue: configuration?.bearerToken ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Connect a private recognition worker to convert your score into clean notation.")
                    Text("Conversion sends the original to this worker. Saved editions remain readable offline.")
                        .foregroundStyle(.secondary)
                }
                Section("Worker connection") {
                    TextField("HTTPS address", text: $address)
                        .textContentType(.URL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("recognition-worker-address")
                    SecureField("Access token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("recognition-worker-token")
                    Text("The connection is stored in Keychain on this iPad, separately from your scores.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if hasConnection {
                    Section {
                        Button("Remove connection", role: .destructive) {
                            perform(onRemove)
                        }
                        Text("Your local scores and recognized editions will stay in the library.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Recognition worker")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save connection") {
                        perform {
                            try onSave(RecognitionWorkerConfiguration(address: address, token: token))
                        }
                    }
                    .disabled(address.isEmpty || token.isEmpty)
                    .accessibilityIdentifier("save-recognition-connection")
                }
            }
            .alert("Could not update the connection", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func perform(_ action: () throws -> Void) {
        do {
            try action()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
