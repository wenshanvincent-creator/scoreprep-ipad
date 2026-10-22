import ScoreCore
import SwiftUI

struct PreparationOrderView: View {
    @Binding var draft: ScorePreparation
    let onEditSection: (ScoreSection) -> Void
    let onRemoveSection: (ScoreSection) -> Void

    var body: some View {
        Form {
            Section("Sections and their areas") {
                ForEach(draft.sections) { section in
                    HStack {
                        Button { onEditSection(section) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(section.name)
                                Text("\(section.systemIDs.count) areas").font(.caption).foregroundStyle(.secondary)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }.accessibilityIdentifier("edit-preparation-section-\(section.id)")
                        Button("Remove section", systemImage: "trash", role: .destructive) {
                            onRemoveSection(section)
                        }.labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                    }.buttonStyle(.borderless)
                }
                Button("Add section", systemImage: "plus") {
                    onEditSection(ScoreSection(name: "Section \(draft.sections.count + 1)", systemIDs: []))
                }.accessibilityIdentifier("add-preparation-section")
            }
            Section("Reading passes") {
                ForEach(Array(draft.readingOrder.enumerated()), id: \.element.id) { index, occurrence in
                    HStack {
                        Text("\(index + 1). \(sectionName(occurrence.sectionID))")
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("preparation-pass-\(index)")
                        Menu("Pass options", systemImage: "ellipsis.circle") {
                            Button("Move earlier", systemImage: "arrow.up") {
                                draft.readingOrder.swapAt(index, index - 1)
                            }.disabled(index == 0)
                            Button("Move later", systemImage: "arrow.down") {
                                draft.readingOrder.swapAt(index, index + 1)
                            }.disabled(index == draft.readingOrder.count - 1)
                            Button("Remove pass", systemImage: "trash", role: .destructive) {
                                draft.readingOrder.removeAll { $0.id == occurrence.id }
                            }
                        }.frame(minWidth: 44, minHeight: 44).accessibilityIdentifier("preparation-pass-actions-\(index)")
                    }.frame(minHeight: 44)
                }
                Menu("Add reading pass", systemImage: "plus") {
                    ForEach(draft.sections) { section in
                        Button(section.name) {
                            draft.readingOrder.append(SectionOccurrence(sectionID: section.id))
                        }.disabled(section.systemIDs.isEmpty)
                        .accessibilityIdentifier("add-preparation-pass-section-\(section.id)")
                    }
                }.accessibilityIdentifier("add-preparation-pass")
                Text("Add the same section again for a repeat. Each pass keeps its own identity when moved; area order is edited inside its section.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }.accessibilityIdentifier("preparation-order-controls")
    }

    private func sectionName(_ id: UUID) -> String {
        draft.sections.first(where: { $0.id == id })?.name ?? "Missing section"
    }
}

struct PreparationSectionEditor: View {
    let section: ScoreSection
    let systems: [SourceSystem]
    let onSave: (ScoreSection) -> Void
    @State private var name: String
    @State private var members: [PreparationMember]
    @Environment(\.dismiss) private var dismiss

    init(section: ScoreSection, systems: [SourceSystem], onSave: @escaping (ScoreSection) -> Void) {
        self.section = section
        self.systems = systems
        self.onSave = onSave
        _name = State(initialValue: section.name)
        _members = State(initialValue: section.systemIDs.map { PreparationMember(systemID: $0) })
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField("Section name", text: $name).accessibilityIdentifier("preparation-section-name") }
                Section("Area order in this section") {
                    ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                        HStack {
                            Text("\(index + 1). \(areaName(member.systemID))")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityIdentifier("preparation-member-\(index)")
                            Menu("Member options", systemImage: "ellipsis.circle") {
                                Button("Move earlier", systemImage: "arrow.up") { members.swapAt(index, index - 1) }
                                    .disabled(index == 0)
                                Button("Move later", systemImage: "arrow.down") { members.swapAt(index, index + 1) }
                                    .disabled(index == members.count - 1)
                                Button("Remove from section", systemImage: "minus.circle", role: .destructive) {
                                    members.removeAll { $0.id == member.id }
                                }
                            }.frame(minWidth: 44, minHeight: 44).accessibilityIdentifier("preparation-member-actions-\(index)")
                        }.frame(minHeight: 44)
                    }
                    Menu("Add area to section", systemImage: "plus") {
                        ForEach(systems) { area in
                            Button("Page \(area.pageIndex + 1): \(area.label)") {
                                members.append(PreparationMember(systemID: area.id))
                            }
                        }
                    }.accessibilityIdentifier("add-preparation-member")
                }
                Section {
                    Text("This order is explicit. Removing a membership keeps its source area; repeated memberships stay separate while editing.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Edit section")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        var updated = section
                        updated.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        updated.systemIDs = members.map(\.systemID)
                        onSave(updated)
                        dismiss()
                    }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("save-preparation-section")
                }
            }
        }
    }

    private func areaName(_ id: UUID) -> String {
        guard let area = systems.first(where: { $0.id == id }) else { return "Missing area" }
        return "Page \(area.pageIndex + 1): \(area.label)"
    }
}
