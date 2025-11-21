/**
 * Tool Management plugin
 * Track and manage CNC tool library
 */

// Helper: Generate unique tool ID
const generateToolId = (tools) => {
  if (tools.length === 0) return 1;
  return Math.max(...tools.map(t => t.id)) + 1;
};

// Helper: Migrate old data structure (id = toolNumber) to new structure (id + toolNumber)
const migrateTools = (tools) => {
  return tools.map(tool => {
    // If tool already has the new structure, return as is
    if (tool.hasOwnProperty('toolNumber')) {
      return tool;
    }
    // Migrate old structure: id becomes toolNumber, generate new internal id
    return {
      ...tool,
      toolNumber: tool.id,
      id: tool.id // Keep same ID for migration
    };
  });
};

// Helper: Validate tool data
const validateTool = (tool, allTools, originalTool = null) => {
  const errors = [];

  // Check tool number if provided
  if (tool.toolNumber !== null && tool.toolNumber !== undefined && tool.toolNumber !== '') {
    const toolNum = parseInt(tool.toolNumber);
    if (!Number.isInteger(toolNum) || toolNum < 1) {
      errors.push('Tool number must be a positive integer');
    }

    // Check for duplicate tool number (excluding current tool in edit mode)
    const duplicate = allTools.find(t =>
      t.toolNumber === toolNum &&
      t.id !== (originalTool ? originalTool.id : null)
    );
    if (duplicate) {
      errors.push(`Tool number ${toolNum} already exists`);
    }
  }

  // Check name
  if (!tool.name || tool.name.trim() === '') {
    errors.push('Tool name is required');
  }

  // Check diameter
  if (!tool.diameter || tool.diameter <= 0) {
    errors.push('Diameter must be greater than 0');
  }

  // Check type
  const validTypes = ['flat', 'ball', 'v-bit', 'drill', 'chamfer', 'surfacing', 'probe'];
  if (!tool.type || !validTypes.includes(tool.type)) {
    errors.push('Invalid tool type');
  }

  return errors;
};

// Helper: Create default tool object
const createDefaultTool = (id, toolNumber = null) => ({
  id: id,
  toolNumber: toolNumber,
  name: '',
  type: 'flat',
  diameter: 0,
  offsets: {
    tlo: 0.0
  },
  metadata: {
    notes: '',
    image: '',
    sku: ''
  },
  dimensions: {
    flute_length: null,
    overall_length: null,
    taper_angle: null,
    radius: null,
    stickout: null
  },
  specs: {
    material: null,
    coating: null
  },
  life: {
    enabled: false,
    total_minutes: null,
    used_minutes: 0,
    remaining_minutes: null,
    usage_count: 0
  }
});

export async function onLoad(ctx) {
  ctx.log('Tool Management plugin loaded');

  ctx.registerToolMenu('Tool Inventory', async () => {
    ctx.log('Tool Inventory opened');

    // Load stored tools and migrate if necessary
    const storedSettings = ctx.getSettings() || {};
    let tools = storedSettings.tools || [];
    tools = migrateTools(tools);

    // Save migrated data if needed
    if (tools.length > 0 && !tools[0].hasOwnProperty('toolNumber')) {
      ctx.setSettings({ tools });
    }

    // Properly escape JSON for embedding in JavaScript template literal
    const toolsJson = JSON.stringify(tools)
      .replace(/\\/g, '\\\\')    // Escape backslashes
      .replace(/'/g, "\\'")      // Escape single quotes
      .replace(/`/g, '\\`')      // Escape backticks
      .replace(/</g, '\\u003c')  // Escape < for HTML safety
      .replace(/>/g, '\\u003e'); // Escape > for HTML safety

    // Get app settings to read tool.count
    const appSettings = ctx.getAppSettings() || {};
    const maxToolCount = appSettings.tool?.count || 1;

    ctx.showDialog(
      'Tool Inventory',
      /* html */ `
      <style>
        .tool-dialog-wrapper {
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          width: 95vw;
          max-width: 1400px;
          height: 90vh;
          max-height: 900px;
        }

        .tool-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .tool-search {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-small);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-size: 0.9rem;
        }

        .tool-search:focus {
          outline: none;
          border-color: var(--color-accent);
        }

        .tool-sort {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-small);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-size: 0.9rem;
          cursor: pointer;
        }

        .tool-content {
          overflow-y: auto;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .tool-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--color-border);
        }

        .section-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .section-count {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .tool-table-container {
          width: 100%;
          overflow-x: auto;
        }

        .tool-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .tool-table th {
          background: var(--color-surface-muted);
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          color: var(--color-text-primary);
          border-bottom: 2px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .tool-table td {
          padding: 12px 8px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        .tool-table th:last-child,
        .tool-table td:last-child {
          text-align: center;
        }

        .tool-table tbody tr:hover {
          background: color-mix(in srgb, var(--color-accent) 10%, transparent);
        }

        .tool-actions {
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .tool-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-border);
        }

        .tool-count {
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }

        .tool-footer-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: var(--radius-small);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .btn:hover {
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--gradient-accent);
          color: white;
        }

        .btn-secondary {
          background: var(--color-surface-muted);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .btn-danger {
          background: var(--color-error);
          color: white;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 0.85rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex: 1;
          padding: 60px 20px;
          color: var(--color-text-secondary);
        }

        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state-text {
          font-size: 1.1rem;
          margin-bottom: 8px;
        }

        .empty-state-hint {
          font-size: 0.9rem;
          opacity: 0.7;
        }

        /* Modal overlay for Add/Edit form */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
        }

        .modal-content {
          background: var(--color-surface);
          border-radius: var(--radius-medium);
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: 6px;
        }

        .form-label.required::after {
          content: ' *';
          color: var(--color-error);
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-small);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-size: 0.9rem;
          font-family: inherit;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-error {
          color: var(--color-error);
          font-size: 0.85rem;
          margin-top: 4px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }

        .hidden {
          display: none;
        }

        input[type="file"] {
          display: none;
        }
      </style>

      <div class="tool-dialog-wrapper">
        <!-- Header with search and actions -->
        <div class="tool-header">
          <input
            type="text"
            class="tool-search"
            id="tool-search"
            placeholder="Search tools by T#, name, or type..."
          >
          <select class="tool-sort" id="tool-sort">
            <option value="toolNumber-asc">Sort by T# (Asc)</option>
            <option value="toolNumber-desc">Sort by T# (Desc)</option>
            <option value="name-asc">Sort by Name (A-Z)</option>
            <option value="name-desc">Sort by Name (Z-A)</option>
            <option value="diameter-asc">Sort by Diameter (Small-Large)</option>
            <option value="diameter-desc">Sort by Diameter (Large-Small)</option>
          </select>
        </div>

        <!-- Content with two tables -->
        <div class="tool-content">
          <!-- Tools in Magazine Section -->
          <div class="tool-section">
            <div class="section-header">
              <h4>Tools in Magazine</h4>
              <span class="section-count" id="magazine-count">0 tools</span>
            </div>
            <div class="tool-table-container">
              <table class="tool-table" id="magazine-table">
                <thead>
                  <tr>
                    <th>T#</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Diameter (mm)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="magazine-tbody">
                  <!-- Populated by JavaScript -->
                </tbody>
              </table>
            </div>
            <div class="empty-state hidden" id="magazine-empty">
              <div class="empty-state-text">No tools loaded in magazine</div>
            </div>
          </div>

          <!-- Tool Library Section -->
          <div class="tool-section">
            <div class="section-header">
              <h4>Tool Library</h4>
              <span class="section-count" id="library-count">0 tools</span>
            </div>
            <div class="tool-table-container">
              <table class="tool-table" id="library-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Diameter (mm)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="library-tbody">
                  <!-- Populated by JavaScript -->
                </tbody>
              </table>
            </div>
            <div class="empty-state hidden" id="library-empty">
              <div class="empty-state-icon">🔧</div>
              <div class="empty-state-text">No tools in your library that are not assigned to the magazine</div>
              <div class="empty-state-hint">Click "Add Tool" to add more tools</div>
            </div>
          </div>
        </div>

        <!-- Footer with count and actions -->
        <div class="tool-footer">
          <div class="tool-count" id="tool-count">0 tools</div>
          <div class="tool-footer-actions">
            <button class="btn btn-secondary" id="import-btn">Import</button>
            <button class="btn btn-secondary" id="export-btn">Export</button>
            <button class="btn btn-primary" id="add-tool-btn">Add Tool</button>
            <button class="btn btn-secondary" id="close-btn">Close</button>
          </div>
        </div>
      </div>

      <!-- Hidden file input for import -->
      <input type="file" id="import-file-input" accept=".json">

      <script>
        (function() {
          let tools = JSON.parse('${toolsJson}');
          let filteredTools = [...tools];
          let currentSort = 'toolNumber-asc';
          let currentSearch = '';
          const maxToolCount = ${maxToolCount};

          // Initialize
          renderTools();
          updateToolCount();

          // Search functionality
          document.getElementById('tool-search').addEventListener('input', function(e) {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
          });

          // Sort functionality
          document.getElementById('tool-sort').addEventListener('change', function(e) {
            currentSort = e.target.value;
            applyFilters();
          });

          // Apply filters and sort
          function applyFilters() {
            // Filter
            if (currentSearch) {
              filteredTools = tools.filter(tool => {
                const toolNum = tool.toolNumber !== null && tool.toolNumber !== undefined ? tool.toolNumber.toString() : '';
                return toolNum.includes(currentSearch) ||
                  tool.name.toLowerCase().includes(currentSearch) ||
                  tool.type.toLowerCase().includes(currentSearch);
              });
            } else {
              filteredTools = [...tools];
            }

            // Sort
            const [field, direction] = currentSort.split('-');
            filteredTools.sort((a, b) => {
              let aVal = field === 'toolNumber' ? (a.toolNumber || 9999) : a[field];
              let bVal = field === 'toolNumber' ? (b.toolNumber || 9999) : b[field];

              if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
              }

              if (direction === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
              } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
              }
            });

            renderTools();
          }

          // Render tools tables
          function renderTools() {
            // Separate tools into magazine (with tool number) and library (without tool number)
            const magazineTools = filteredTools.filter(t => t.toolNumber !== null && t.toolNumber !== undefined);
            const libraryTools = filteredTools.filter(t => t.toolNumber === null || t.toolNumber === undefined);

            // Render magazine table
            const magazineTbody = document.getElementById('magazine-tbody');
            const magazineEmpty = document.getElementById('magazine-empty');
            const magazineTable = document.getElementById('magazine-table');
            const magazineCountEl = document.getElementById('magazine-count');

            if (magazineTools.length === 0) {
              magazineTable.classList.add('hidden');
              magazineEmpty.classList.remove('hidden');
              magazineTbody.innerHTML = '';
            } else {
              magazineTable.classList.remove('hidden');
              magazineEmpty.classList.add('hidden');

              magazineTbody.innerHTML = magazineTools.map(tool => \`
                <tr>
                  <td>T\${tool.toolNumber}</td>
                  <td>\${escapeHtml(tool.name)}</td>
                  <td>\${formatType(tool.type)}</td>
                  <td>\${tool.diameter.toFixed(3)}</td>
                  <td>
                    <div class="tool-actions">
                      <button class="btn btn-small btn-secondary" onclick="window.editTool(\${tool.id})">Edit</button>
                      <button class="btn btn-small btn-danger" onclick="window.deleteTool(\${tool.id})">Delete</button>
                    </div>
                  </td>
                </tr>
              \`).join('');
            }
            magazineCountEl.textContent = \`\${magazineTools.length} tool\${magazineTools.length !== 1 ? 's' : ''}\`;

            // Render library table (tools without tool numbers)
            const libraryTbody = document.getElementById('library-tbody');
            const libraryEmpty = document.getElementById('library-empty');
            const libraryTable = document.getElementById('library-table');
            const libraryCountEl = document.getElementById('library-count');

            if (libraryTools.length === 0) {
              libraryTable.classList.add('hidden');
              libraryEmpty.classList.remove('hidden');
              libraryTbody.innerHTML = '';
            } else {
              libraryTable.classList.remove('hidden');
              libraryEmpty.classList.add('hidden');

              libraryTbody.innerHTML = libraryTools.map(tool => \`
                <tr>
                  <td>\${escapeHtml(tool.name)}</td>
                  <td>\${formatType(tool.type)}</td>
                  <td>\${tool.diameter.toFixed(3)}</td>
                  <td>
                    <div class="tool-actions">
                      <button class="btn btn-small btn-secondary" onclick="window.editTool(\${tool.id})">Edit</button>
                      <button class="btn btn-small btn-danger" onclick="window.deleteTool(\${tool.id})">Delete</button>
                    </div>
                  </td>
                </tr>
              \`).join('');
            }
            libraryCountEl.textContent = \`\${libraryTools.length} tool\${libraryTools.length !== 1 ? 's' : ''}\`;
          }

          // Update tool count
          function updateToolCount() {
            const count = tools.length;
            document.getElementById('tool-count').textContent = \`\${count} tool\${count !== 1 ? 's' : ''}\`;

            // Note: We don't disable Add Tool button anymore since tools can exist without tool numbers
          }

          // Format tool type
          function formatType(type) {
            const typeMap = {
              'flat': 'Flat End Mill',
              'ball': 'Ball End Mill',
              'v-bit': 'V-Bit',
              'drill': 'Drill',
              'chamfer': 'Chamfer',
              'surfacing': 'Surfacing',
              'probe': 'Probe'
            };
            return typeMap[type] || type;
          }

          // Escape HTML
          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }

          // Add tool
          document.getElementById('add-tool-btn').addEventListener('click', function() {
            // Generate new internal ID
            const newId = tools.length === 0 ? 1 : Math.max(...tools.map(t => t.id)) + 1;
            showToolForm(null, newId);
          });

          // Edit tool
          window.editTool = function(toolId) {
            const tool = tools.find(t => t.id === toolId);
            if (tool) {
              showToolForm(tool);
            }
          };

          // Delete tool
          window.deleteTool = function(toolId) {
            const tool = tools.find(t => t.id === toolId);
            if (!tool) return;

            if (confirm(\`Are you sure you want to delete T\${tool.id} - \${tool.name}?\`)) {
              tools = tools.filter(t => t.id !== toolId);
              saveTools();
              applyFilters();
              updateToolCount();
            }
          };

          // Show tool form
          function showToolForm(tool, newId = null) {
            const isEdit = tool !== null;
            const formData = tool || {
              id: newId,
              toolNumber: null,
              name: '',
              type: 'flat',
              diameter: 0,
              offsets: { tlo: 0 },
              metadata: { notes: '', image: '', sku: '' }
            };

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            // Build HTML using string concatenation to avoid template literal nesting issues
            let html = '<div class="modal-content">';
            html += '<div class="modal-header">' + (isEdit ? 'Edit Tool' : 'Add Tool') + '</div>';
            html += '<form id="tool-form">';

            // Tool Number (Optional)
            html += '<div class="form-group">';
            html += '<label class="form-label">Tool Number (T#)</label>';
            html += '<select class="form-select" id="form-toolnumber">';

            // Add "None" option
            const hasNoToolNumber = formData.toolNumber === null || formData.toolNumber === undefined;
            html += '<option value=""' + (hasNoToolNumber ? ' selected' : '') + '>None (Not in magazine)</option>';

            // Show all tool numbers (including assigned ones with swap indicator)
            for (let i = 1; i <= maxToolCount; i++) {
              const selected = i === formData.toolNumber ? ' selected' : '';

              // Check if this tool number is already assigned to another tool
              const assignedTool = tools.find(t => t.toolNumber === i && (!isEdit || t.id !== formData.id));

              if (assignedTool) {
                // Show with swap indicator
                html += '<option value="' + i + '"' + selected + '>T' + i + ' (Swap with: ' + escapeHtml(assignedTool.name) + ')</option>';
              } else {
                // Available slot
                html += '<option value="' + i + '"' + selected + '>T' + i + '</option>';
              }
            }

            html += '</select>';
            html += '<div class="form-error hidden" id="error-toolnumber"></div>';
            html += '</div>';

            // Tool Name
            html += '<div class="form-group">';
            html += '<label class="form-label required">Tool Name / Description</label>';
            html += '<input type="text" class="form-input" id="form-name" ';
            html += 'value="' + escapeHtml(formData.name) + '" ';
            html += 'placeholder="e.g., 1/4in Flat Endmill" required>';
            html += '<div class="form-error hidden" id="error-name"></div>';
            html += '</div>';

            // Tool Type
            html += '<div class="form-group">';
            html += '<label class="form-label required">Tool Type</label>';
            html += '<select class="form-select" id="form-type" required>';
            html += '<option value="flat"' + (formData.type === 'flat' ? ' selected' : '') + '>Flat End Mill</option>';
            html += '<option value="ball"' + (formData.type === 'ball' ? ' selected' : '') + '>Ball End Mill</option>';
            html += '<option value="v-bit"' + (formData.type === 'v-bit' ? ' selected' : '') + '>V-Bit</option>';
            html += '<option value="drill"' + (formData.type === 'drill' ? ' selected' : '') + '>Drill</option>';
            html += '<option value="chamfer"' + (formData.type === 'chamfer' ? ' selected' : '') + '>Chamfer</option>';
            html += '<option value="surfacing"' + (formData.type === 'surfacing' ? ' selected' : '') + '>Surfacing</option>';
            html += '<option value="probe"' + (formData.type === 'probe' ? ' selected' : '') + '>Probe</option>';
            html += '</select>';
            html += '</div>';

            // Diameter
            html += '<div class="form-group">';
            html += '<label class="form-label required">Diameter (mm)</label>';
            html += '<input type="number" class="form-input" id="form-diameter" ';
            html += 'value="' + formData.diameter + '" min="0.001" step="0.001" ';
            html += 'placeholder="6.350" required>';
            html += '<div class="form-error hidden" id="error-diameter"></div>';
            html += '</div>';

            // TLO (hidden for now)
            html += '<div class="form-group hidden">';
            html += '<label class="form-label">Tool Length Offset - TLO (mm)</label>';
            html += '<input type="number" class="form-input" id="form-tlo" ';
            html += 'value="' + formData.offsets.tlo + '" step="0.001" placeholder="0">';
            html += '</div>';

            // Notes
            html += '<div class="form-group">';
            html += '<label class="form-label">Notes</label>';
            html += '<textarea class="form-textarea" id="form-notes" ';
            html += 'placeholder="Any additional information about this tool...">';
            html += escapeHtml(formData.metadata.notes || '');
            html += '</textarea>';
            html += '</div>';

            // SKU
            html += '<div class="form-group">';
            html += '<label class="form-label">SKU / Part Number</label>';
            html += '<input type="text" class="form-input" id="form-sku" ';
            html += 'value="' + escapeHtml(formData.metadata.sku || '') + '" ';
            html += 'placeholder="e.g., MANUFACTURER-12345">';
            html += '</div>';

            // Image URL (hidden for now)
            html += '<div class="form-group hidden">';
            html += '<label class="form-label">Image URL</label>';
            html += '<input type="text" class="form-input" id="form-image" ';
            html += 'value="' + escapeHtml(formData.metadata.image || '') + '" ';
            html += 'placeholder="https://...">';
            html += '</div>';

            // Footer
            html += '<div class="modal-footer">';
            html += '<button type="button" class="btn btn-secondary" id="form-cancel">Cancel</button>';
            html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Tool') + '</button>';
            html += '</div>';

            html += '</form>';
            html += '</div>';

            overlay.innerHTML = html;
            document.body.appendChild(overlay);

            // Cancel button
            document.getElementById('form-cancel').addEventListener('click', function() {
              document.body.removeChild(overlay);
            });

            // Form submission
            document.getElementById('tool-form').addEventListener('submit', function(e) {
              e.preventDefault();

              // Collect form data
              const toolNumberValue = document.getElementById('form-toolnumber').value;
              const newToolNumber = toolNumberValue === '' ? null : parseInt(toolNumberValue);

              const newTool = {
                id: formData.id, // Keep internal ID
                toolNumber: newToolNumber,
                name: document.getElementById('form-name').value.trim(),
                type: document.getElementById('form-type').value,
                diameter: parseFloat(document.getElementById('form-diameter').value),
                offsets: {
                  tlo: parseFloat(document.getElementById('form-tlo').value) || 0
                },
                metadata: {
                  notes: document.getElementById('form-notes').value.trim(),
                  image: document.getElementById('form-image').value.trim(),
                  sku: document.getElementById('form-sku').value.trim()
                },
                dimensions: formData.dimensions || {
                  flute_length: null,
                  overall_length: null,
                  taper_angle: null,
                  radius: null,
                  stickout: null
                },
                specs: formData.specs || {
                  material: null,
                  coating: null
                },
                life: formData.life || {
                  enabled: false,
                  total_minutes: null,
                  used_minutes: 0,
                  remaining_minutes: null,
                  usage_count: 0
                }
              };

              // Validate
              const errors = validateTool(newTool, tools, tool);
              if (errors.length > 0) {
                alert('Validation errors:\\n' + errors.join('\\n'));
                return;
              }

              // Handle tool number swapping
              if (newToolNumber !== null) {
                // Check if another tool has this tool number
                const toolWithSameNumber = tools.find(t =>
                  t.toolNumber === newToolNumber &&
                  t.id !== formData.id
                );

                if (toolWithSameNumber) {
                  // Swap: give the other tool this tool's old number (or null)
                  const oldToolNumber = formData.toolNumber;
                  toolWithSameNumber.toolNumber = oldToolNumber;
                }
              }

              // Save
              if (isEdit) {
                const index = tools.findIndex(t => t.id === tool.id);
                tools[index] = newTool;
              } else {
                tools.push(newTool);
              }

              saveTools();
              applyFilters();
              updateToolCount();
              document.body.removeChild(overlay);
            });
          }

          // Validate tool
          function validateTool(tool, allTools, originalTool) {
            const errors = [];

            if (!tool.id || !Number.isInteger(tool.id) || tool.id < 1) {
              errors.push('Tool number must be a positive integer');
            }

            const duplicate = allTools.find(t => t.id === tool.id && t !== originalTool);
            if (duplicate) {
              errors.push(\`Tool number \${tool.id} already exists\`);
            }

            if (!tool.name || tool.name.trim() === '') {
              errors.push('Tool name is required');
            }

            if (!tool.diameter || tool.diameter <= 0) {
              errors.push('Diameter must be greater than 0');
            }

            return errors;
          }

          // Save tools
          async function saveTools() {
            try {
              const response = await fetch('/api/plugins/com.ncsender.toolinventory/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tools: tools })
              });

              if (!response.ok) {
                console.error('Failed to save tools');
              } else {
                // Broadcast event to notify other components (like GCodeVisualizer)
                window.postMessage({
                  type: 'tool-inventory-updated',
                  pluginId: 'com.ncsender.toolinventory',
                  data: { tools: tools }
                }, '*');
              }
            } catch (error) {
              console.error('Error saving tools:', error);
            }
          }

          // Export tools
          document.getElementById('export-btn').addEventListener('click', function() {
            if (tools.length === 0) {
              alert('No tools to export');
              return;
            }

            const json = JSON.stringify(tools, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`tool-library-\${new Date().toISOString().split('T')[0]}.json\`;
            a.click();
            URL.revokeObjectURL(url);
          });

          // Import tools
          document.getElementById('import-btn').addEventListener('click', function() {
            document.getElementById('import-file-input').click();
          });

          document.getElementById('import-file-input').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
              try {
                const importedTools = JSON.parse(event.target.result);

                if (!Array.isArray(importedTools)) {
                  alert('Invalid file format. Expected an array of tools.');
                  return;
                }

                // Validate imported tools
                const validationErrors = [];
                importedTools.forEach((tool, index) => {
                  const errors = validateTool(tool, [], null);
                  if (errors.length > 0) {
                    validationErrors.push(\`Tool #\${index + 1}: \${errors.join(', ')}\`);
                  }
                });

                if (validationErrors.length > 0) {
                  alert('Import validation failed:\\n' + validationErrors.slice(0, 5).join('\\n'));
                  return;
                }

                // Check for conflicts
                const conflicts = importedTools.filter(importTool =>
                  tools.some(existingTool => existingTool.id === importTool.id)
                );

                if (conflicts.length > 0) {
                  const conflictList = conflicts.map(t => \`T\${t.id}\`).join(', ');
                  if (!confirm(\`The following tool numbers already exist: \${conflictList}\\n\\nDo you want to replace existing tools and import?\`)) {
                    return;
                  }
                }

                // Merge tools (replace existing, add new)
                importedTools.forEach(importTool => {
                  const existingIndex = tools.findIndex(t => t.id === importTool.id);
                  if (existingIndex >= 0) {
                    tools[existingIndex] = importTool;
                  } else {
                    tools.push(importTool);
                  }
                });

                saveTools();
                applyFilters();
                updateToolCount();
                alert(\`Successfully imported \${importedTools.length} tool(s)\`);

              } catch (error) {
                alert('Failed to import tools. Invalid JSON file.');
                console.error('Import error:', error);
              }
            };
            reader.readAsText(file);

            // Reset file input
            e.target.value = '';
          });

          // Close dialog
          document.getElementById('close-btn').addEventListener('click', function() {
            window.postMessage({ type: 'close-plugin-dialog' }, '*');
          });
        })();
      </script>
    `,
      { size: 'large', closable: false }
    );
  });
}

export async function onUnload(ctx) {
  ctx.log('Tool Management plugin unloading');
}
