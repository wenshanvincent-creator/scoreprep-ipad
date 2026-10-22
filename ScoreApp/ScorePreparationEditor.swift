import PDFKit
import ScoreCore
import SwiftUI

struct ScorePreparationEditor: View {
    let document: PDFDocument
    let onSave: (ScorePreparation) throws -> Void
    @State private var draft: ScorePreparation
    @State private var pageIndex: Int
    @State private var selectedAreaID: UUID?
    @State private var mode = PreparationMode.areas
    @State private var editingSection: ScoreSection?
    @State private var removingArea: SourceSystem?
    @State private var removingSection: ScoreSection?
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(project: ScoreProject, document: PDFDocument, initialPageIndex: Int,
         onSave: @escaping (ScorePreparation) throws -> Void) {
        self.document = document
        self.onSave = onSave
        // Preparation is a local sheet draft until the single Save operation.
        _draft = State(initialValue: ScorePreparation(project: project))
        _pageIndex = State(initialValue: initialPageIndex)
        _selectedAreaID = State(initialValue: project.systems.first {
            $0.pageIndex == initialPageIndex
        }?.id)
    }

    private var pageAreas: [SourceSystem] { draft.systems.filter { $0.pageIndex == pageIndex } }
    private var selectedArea: SourceSystem? { draft.systems.first { $0.id == selectedAreaID } }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Preparation", selection: $mode) {
                    Text("Areas").tag(PreparationMode.areas)
                    Text("Reading order").tag(PreparationMode.order)
                }.pickerStyle(.segmented).padding().accessibilityIdentifier("preparation-mode")
                if mode == .areas { areaLayout }
                else {
                    PreparationOrderView(draft: $draft,
                        onEditSection: { editingSection = $0 },
                        onRemoveSection: { removingSection = $0 })
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Prepare score")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.accessibilityIdentifier("cancel-preparation")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save preparation", action: save).accessibilityIdentifier("save-preparation")
                }
            }
            .sheet(item: $editingSection) { section in
                PreparationSectionEditor(section: section, systems: draft.systems) { updated in
                    if let index = draft.sections.firstIndex(where: { $0.id == updated.id }) {
                        draft.sections[index] = updated
                    } else { draft.sections.append(updated) }
                }
            }
            .confirmationDialog("Remove this area from every section? The original page stays available.",
                isPresented: Binding(get: { removingArea != nil }, set: { if !$0 { removingArea = nil } }),
                titleVisibility: .visible) {
                Button("Remove area", role: .destructive) {
                    if let area = removingArea {
                        PreparationEditing.removeArea(area.id, from: &draft)
                    }
                }
            }
            .confirmationDialog("Remove this section and all its reading passes?",
                isPresented: Binding(get: { removingSection != nil }, set: { if !$0 { removingSection = nil } }),
                titleVisibility: .visible) {
                Button("Remove section", role: .destructive) {
                    if let section = removingSection {
                        PreparationEditing.removeSection(section.id, from: &draft)
                    }
                }
            }
            .alert("Could not save preparation", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }
        .presentationSizing(.page)
        .interactiveDismissDisabled()
        .onChange(of: pageIndex) { _, _ in selectedAreaID = pageAreas.first?.id }
        .onChange(of: draft.systems.map(\.id)) { _, _ in
            if !pageAreas.contains(where: { $0.id == selectedAreaID }) {
                selectedAreaID = pageAreas.first?.id
            }
        }
    }

    private var areaLayout: some View {
        GeometryReader { geometry in
            if geometry.size.width >= 760 && !dynamicTypeSize.isAccessibilitySize {
                HStack(spacing: 0) {
                    preview.padding(20).frame(maxWidth: .infinity)
                    areaControls.frame(width: 360)
                }
            } else {
                VStack(spacing: 0) {
                    preview.padding(.horizontal, 16)
                        .frame(maxWidth: .infinity, maxHeight: geometry.size.height * 0.34)
                    areaControls
                }
            }
        }
    }

    @ViewBuilder private var preview: some View {
        if let page = document.page(at: pageIndex) {
            SourcePageSurface(page: page)
                .overlay {
                    GeometryReader { geometry in
                        ForEach(Array(pageAreas.enumerated()), id: \.element.id) { number, area in
                            Rectangle()
                                .stroke(area.id == selectedAreaID ? Color.accentColor : Color.secondary,
                                    lineWidth: area.id == selectedAreaID ? 3 : 1)
                                .overlay(alignment: .topLeading) {
                                    Text("\(number + 1)").font(.caption.bold()).padding(3)
                                        .background(.background)
                                }
                                .frame(width: geometry.size.width * area.bounds.width,
                                       height: geometry.size.height * area.bounds.height)
                                .offset(x: geometry.size.width * area.bounds.x,
                                        y: geometry.size.height * area.bounds.y)
                        }
                    }.accessibilityHidden(true)
                }
                .accessibilityLabel("Full original page \(pageIndex + 1), with reading area outlines")
        } else {
            ContentUnavailableView("Original page is unavailable", systemImage: "doc")
        }
    }

    private var areaControls: some View {
        Form {
            Section {
                Picker("Original page", selection: $pageIndex) {
                    ForEach(0..<document.pageCount, id: \.self) { page in
                        Text("Page \(page + 1)").tag(page)
                    }
                }.accessibilityIdentifier("preparation-page")
                Text("Keep all staves, clefs and markings inside each complete-system area.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("Areas on this page") {
                ForEach(Array(pageAreas.enumerated()), id: \.element.id) { index, area in
                    HStack {
                        Button { selectedAreaID = area.id } label: {
                            HStack {
                                Text("\(index + 1). \(area.label)")
                                Spacer()
                                if selectedAreaID == area.id { Image(systemName: "checkmark") }
                            }.frame(minHeight: 44)
                        }
                        .accessibilityIdentifier("select-preparation-area-\(index)")
                        Menu("Area options", systemImage: "ellipsis.circle") {
                            Button("Move earlier", systemImage: "arrow.up") {
                                PreparationEditing.moveArea(area.id, by: -1, in: &draft)
                            }.disabled(index == 0)
                            Button("Move later", systemImage: "arrow.down") {
                                PreparationEditing.moveArea(area.id, by: 1, in: &draft)
                            }.disabled(index == pageAreas.count - 1)
                            Button("Remove area", systemImage: "trash", role: .destructive) {
                                removingArea = area
                            }
                        }.frame(minWidth: 44, minHeight: 44)
                        .accessibilityIdentifier("preparation-area-actions-\(index)")
                    }.buttonStyle(.borderless)
                }
                Menu("Add reading area", systemImage: "plus") {
                    ForEach(draft.sections) { section in
                        Button("Add to \(section.name)") {
                            selectedAreaID = PreparationEditing.addArea(to: &draft,
                                page: pageIndex, sectionID: section.id)
                        }.accessibilityIdentifier("add-preparation-area-to-\(section.id)")
                    }
                }.disabled(draft.sections.isEmpty).accessibilityIdentifier("add-preparation-area")
                Text("Choose a section when adding an area. Move earlier/later changes only the page list and manual browsing. Edit musical order inside Reading order. Shape the existing full-page area to its first system before adding the next.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if let area = selectedArea {
                Section("Selected area") {
                    TextField("Area name", text: Binding(get: { area.label }, set: { value in
                        if let index = draft.systems.firstIndex(where: { $0.id == area.id }) {
                            draft.systems[index].label = value
                        }
                    })).accessibilityIdentifier("preparation-area-name")
                    ReadingAreaBoundsControls(crop: Binding(get: { area.bounds }, set: {
                        PreparationEditing.setBounds($0, areaID: area.id, in: &draft)
                    }))
                    .id(area.id)
                    Button("Use full page") {
                        PreparationEditing.setBounds(.fullPage, areaID: area.id, in: &draft)
                    }
                    Text("Changing the crop requires timing to be confirmed again. The original stays unchanged.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }.accessibilityIdentifier("preparation-area-controls")
    }

    private func save() {
        guard draft.systems.allSatisfy({ !$0.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            errorMessage = "Give every reading area a name."
            return
        }
        do { try onSave(draft); dismiss() }
        catch { errorMessage = error.localizedDescription }
    }
}

private enum PreparationMode: Hashable { case areas, order }
