// State management
let aliasIndex = 1;
let configOptions = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfigOptions();
    generateForm();
    initializeEventListeners();
    updateOutput();
});

// Load config options from JSON
async function loadConfigOptions() {
    try {
        const response = await fetch('config-options.json');
        configOptions = await response.json();
    } catch (error) {
        console.error('Error loading config options:', error);
        alert('Error loading config options. Please ensure config-options.json is available.');
    }
}

// Generate form from config options
function generateForm() {
    const container = document.getElementById('configSections');
    container.innerHTML = '';

    // Group options by section
    const sections = {};
    configOptions.forEach(option => {
        const sectionKey = option.section;
        if (!sections[sectionKey]) {
            sections[sectionKey] = [];
        }
        sections[sectionKey].push(option);
    });

    // Generate sections
    for (const [section, options] of Object.entries(sections)) {
        const sectionEl = document.createElement('section');
        sectionEl.className = 'config-section';
        sectionEl.innerHTML = `<h2>[${section}]</h2>`;

        options.forEach(option => {
            const formGroup = createFormGroup(option);
            sectionEl.appendChild(formGroup);
        });

        container.appendChild(sectionEl);
    }
}

// Create a form group for an option
function createFormGroup(option) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    if (option.default !== null) {
        formGroup.classList.add('has-default');
    }

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'option-toggle';
    checkbox.dataset.section = option.section;
    checkbox.dataset.key = option.name;
    checkbox.dataset.configName = option.configName || option.name;

    const labelText = document.createElement('span');
    labelText.textContent = option.displayName;
    
    // Add description tooltip
    if (option.description) {
        labelText.title = option.description;
        labelText.className = 'option-label';
    }

    label.appendChild(checkbox);
    label.appendChild(labelText);

    let input;
    if (option.type === 'select') {
        input = document.createElement('select');
        input.className = 'config-input default-state';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = option.default !== null ? `(default: ${option.default})` : '(default)';
        input.appendChild(defaultOption);
        
        option.options.forEach(optValue => {
            const opt = document.createElement('option');
            opt.value = optValue;
            opt.textContent = optValue;
            input.appendChild(opt);
        });
    } else {
        input = document.createElement('input');
        input.type = option.type || 'text';
        input.className = 'config-input default-state';
        if (option.default !== null && option.type !== 'select') {
            input.placeholder = `(default: ${option.default})`;
        }
    }

    input.dataset.section = option.section;
    input.dataset.key = option.name;
    input.dataset.configName = option.configName || option.name;
    input.disabled = true;

    // Set default value if provided
    if (option.default !== null) {
        if (option.type === 'select') {
            input.value = option.default;
        } else {
            input.value = option.default;
        }
    }

    formGroup.appendChild(label);
    formGroup.appendChild(input);

    // Add description below input if provided
    if (option.description) {
        const desc = document.createElement('div');
        desc.className = 'option-description';
        desc.textContent = option.description;
        formGroup.appendChild(desc);
    }

    return formGroup;
}

function initializeEventListeners() {
    // Drag and drop
    const dragDropArea = document.getElementById('dragDropArea');
    const fileInput = document.getElementById('fileInput');

    dragDropArea.addEventListener('click', () => fileInput.click());
    dragDropArea.addEventListener('dragover', handleDragOver);
    dragDropArea.addEventListener('dragleave', handleDragLeave);
    dragDropArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Toggle checkboxes - use event delegation since form is dynamically generated
    document.getElementById('configForm').addEventListener('change', (e) => {
        if (e.target.classList.contains('option-toggle')) {
            handleToggle(e);
        }
    });

    // Input changes - use event delegation
    document.getElementById('configForm').addEventListener('input', (e) => {
        if (e.target.classList.contains('config-input')) {
            const toggle = document.querySelector(
                `.option-toggle[data-section="${e.target.dataset.section}"][data-key="${e.target.dataset.key}"]`
            );
            if (toggle && !toggle.checked) {
                toggle.checked = true;
                handleToggle({ target: toggle });
            }
            updateOutput();
        }
    });

    // Aliases
    document.getElementById('addAliasBtn').addEventListener('click', addAlias);
    document.querySelectorAll('.alias-name, .alias-value').forEach(input => {
        input.addEventListener('input', updateOutput);
    });

    // Controls
    document.getElementById('showDefaults').addEventListener('change', toggleShowDefaults);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    document.getElementById('copyBtn').addEventListener('click', copyConfig);
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        loadConfigFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        loadConfigFile(files[0]);
    }
}

// Parse and load config file
function loadConfigFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const config = parseGitConfig(content);
            populateForm(config);
            updateOutput();
        } catch (error) {
            alert('Error parsing config file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Parse git config INI format
function parseGitConfig(content) {
    const config = {};
    let currentSection = null;
    let currentSubsection = null;
    const lines = content.split('\n');

    for (let line of lines) {
        line = line.trim();

        // Skip comments and empty lines
        if (!line || line.startsWith('#')) {
            continue;
        }

        // Section header [section] or [section "subsection"]
        const sectionMatch = line.match(/^\[([^\s"]+)(?:\s+"([^"]+)")?\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            currentSubsection = sectionMatch[2] || null;
            
            if (!config[currentSection]) {
                config[currentSection] = {};
            }
            
            // Handle subsection format for aliases: [alias "co"]
            if (currentSubsection && currentSection === 'alias') {
                // This will be handled when we see the value
            }
            
            continue;
        }

        // Key = value
        const keyValueMatch = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (keyValueMatch && currentSection) {
            const key = keyValueMatch[1].trim();
            let value = keyValueMatch[2].trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Handle subsection format: [alias "co"] with just "value" on next line
            if (currentSubsection && currentSection === 'alias') {
                config[currentSection][currentSubsection] = value;
                currentSubsection = null;
            } else {
                // Regular key-value pair
                // Map config names back to option names if needed
                let actualKey = key;
                if (configOptions && configOptions.length > 0) {
                    const option = configOptions.find(opt => 
                        opt.section === currentSection && 
                        (opt.configName === key || opt.name === key)
                    );
                    if (option) {
                        actualKey = option.name;
                    } else {
                        // Try converting kebab-case to camelCase (e.g., default-branch -> defaultBranch)
                        const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                        const optionByCamel = configOptions.find(opt => 
                            opt.section === currentSection && opt.name === camelKey
                        );
                        if (optionByCamel) {
                            actualKey = optionByCamel.name;
                        }
                    }
                }
                config[currentSection][actualKey] = value;
            }
        }
    }

    return config;
}

// Populate form with config data
function populateForm(config) {
    // Clear all first
    clearAll();

    // Populate regular fields
    for (const [section, values] of Object.entries(config)) {
        if (section === 'alias') {
            // Handle aliases separately
            for (const [aliasName, aliasValue] of Object.entries(values)) {
                addAlias(aliasName, aliasValue);
            }
            continue;
        }

        for (const [key, value] of Object.entries(values)) {
            // Find the option that matches this key (check both name and configName)
            const option = configOptions.find(opt => 
                opt.section === section && 
                (opt.name === key || opt.configName === key || 
                 (opt.configName && opt.configName === key) ||
                 (opt.name && opt.name.replace(/([A-Z])/g, '-$1').toLowerCase() === key))
            );

            if (!option) {
                // Try to find by converting key (e.g., default-branch -> defaultBranch)
                const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                const optionByCamel = configOptions.find(opt => 
                    opt.section === section && opt.name === camelKey
                );
                if (optionByCamel) {
                    const input = document.querySelector(
                        `.config-input[data-section="${section}"][data-key="${optionByCamel.name}"]`
                    );
                    const toggle = document.querySelector(
                        `.option-toggle[data-section="${section}"][data-key="${optionByCamel.name}"]`
                    );
                    if (input && toggle) {
                        if (input.tagName === 'SELECT') {
                            input.value = value;
                        } else {
                            input.value = value;
                        }
                        toggle.checked = true;
                        handleToggle({ target: toggle });
                    }
                }
                continue;
            }

            const input = document.querySelector(
                `.config-input[data-section="${section}"][data-key="${option.name}"]`
            );
            const toggle = document.querySelector(
                `.option-toggle[data-section="${section}"][data-key="${option.name}"]`
            );

            if (input && toggle) {
                if (input.tagName === 'SELECT') {
                    input.value = value;
                } else {
                    input.value = value;
                }
                toggle.checked = true;
                handleToggle({ target: toggle });
            }
        }
    }
}

// Toggle option on/off
function handleToggle(e) {
    const toggle = e.target;
    const section = toggle.dataset.section;
    const key = toggle.dataset.key;

    const input = document.querySelector(
        `.config-input[data-section="${section}"][data-key="${key}"]`
    );
    const formGroup = toggle.closest('.form-group');

    if (!input || !formGroup) return;

    // Find the option to get default value
    const option = configOptions.find(opt => opt.section === section && opt.name === key);

    if (toggle.checked) {
        input.classList.remove('default-state');
        input.disabled = false;
        if (formGroup) {
            formGroup.classList.remove('hidden');
        }
        // Restore default value if it was cleared
        if (option && option.default !== null && !input.value) {
            input.value = option.default;
        }
    } else {
        input.classList.add('default-state');
        input.disabled = true;
        // Reset to default value if option has one
        if (option && option.default !== null) {
            input.value = option.default;
        } else {
            input.value = '';
        }
        if (formGroup && !document.getElementById('showDefaults').checked) {
            formGroup.classList.add('hidden');
        }
    }

    updateOutput();
}

// Toggle show defaults
function toggleShowDefaults(e) {
    const showDefaults = e.target.checked;
    document.querySelectorAll('.form-group').forEach(group => {
        const toggle = group.querySelector('.option-toggle');
        if (toggle && !toggle.checked) {
            if (showDefaults) {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
        }
    });
}

// Generate config output
function updateOutput() {
    const config = {};

    // Collect all enabled options
    document.querySelectorAll('.option-toggle:checked').forEach(toggle => {
        const section = toggle.dataset.section;
        const key = toggle.dataset.key;
        const input = document.querySelector(
            `.config-input[data-section="${section}"][data-key="${key}"]`
        );

        if (input && input.value.trim()) {
            if (!config[section]) {
                config[section] = {};
            }
            config[section][key] = input.value.trim();
        }
    });

    // Collect aliases
    const aliases = {};
    document.querySelectorAll('.alias-item').forEach(item => {
        const nameInput = item.querySelector('.alias-name');
        const valueInput = item.querySelector('.alias-value');
        const name = nameInput.value.trim();
        const value = valueInput.value.trim();

        if (name && value) {
            aliases[name] = value;
        }
    });

    if (Object.keys(aliases).length > 0) {
        config.alias = aliases;
    }

    // Generate config string
    let output = '';
    for (const [section, values] of Object.entries(config)) {
        if (Object.keys(values).length === 0) continue;

        // Special handling for aliases - use simple format
        if (section === 'alias') {
            output += `[${section}]\n`;
            for (const [key, value] of Object.entries(values)) {
                // Quote alias names with spaces or special characters
                let outputKey = key;
                if (key.includes(' ') || key.includes('=') || key.includes('"')) {
                    outputKey = `"${key.replace(/"/g, '\\"')}"`;
                }

                // Quote values with spaces or special characters
                let outputValue = value;
                if (value.includes(' ') || value.includes('=') || value.includes('"')) {
                    outputValue = `"${value.replace(/"/g, '\\"')}"`;
                }

                output += `\t${outputKey} = ${outputValue}\n`;
            }
            output += '\n';
            continue;
        }

        output += `[${section}]\n`;
        for (const [key, value] of Object.entries(values)) {
            // Find the option to get the correct config name
            const option = configOptions.find(opt => opt.section === section && opt.name === key);
            let outputKey = option && option.configName ? option.configName : key;

            // Skip if value matches default (unless explicitly set)
            if (option && option.default !== null && value === option.default) {
                // Still include it if the toggle is checked
                const toggle = document.querySelector(
                    `.option-toggle[data-section="${section}"][data-key="${key}"]`
                );
                if (!toggle || !toggle.checked) {
                    continue;
                }
            }

            // Quote values with spaces or special characters
            let outputValue = value;
            if (value.includes(' ') || value.includes('=') || value.includes('"')) {
                outputValue = `"${value.replace(/"/g, '\\"')}"`;
            }

            output += `\t${outputKey} = ${outputValue}\n`;
        }
        output += '\n';
    }

    document.getElementById('output').textContent = output.trim() || '# No configuration options selected';
}

// Clear all fields
function clearAll() {
    document.querySelectorAll('.option-toggle').forEach(toggle => {
        toggle.checked = false;
        handleToggle({ target: toggle });
    });

    // Clear aliases
    const container = document.getElementById('aliasesContainer');
    container.innerHTML = '<div class="alias-item"><input type="text" class="alias-name" placeholder="Alias name" data-index="0"><span>=</span><input type="text" class="alias-value" placeholder="Git command" data-index="0"><button type="button" class="btn-remove" onclick="removeAlias(this)">×</button></div>';
    aliasIndex = 1;

    // Re-attach event listeners
    document.querySelectorAll('.alias-name, .alias-value').forEach(input => {
        input.addEventListener('input', updateOutput);
    });

    updateOutput();
}

// Add alias
function addAlias(name = '', value = '') {
    const container = document.getElementById('aliasesContainer');
    const aliasItem = document.createElement('div');
    aliasItem.className = 'alias-item';
    aliasItem.innerHTML = `
        <input type="text" class="alias-name" placeholder="Alias name" data-index="${aliasIndex}" value="${name}">
        <span>=</span>
        <input type="text" class="alias-value" placeholder="Git command" data-index="${aliasIndex}" value="${value}">
        <button type="button" class="btn-remove" onclick="removeAlias(this)">×</button>
    `;

    container.appendChild(aliasItem);
    aliasIndex++;

    // Attach event listeners
    const nameInput = aliasItem.querySelector('.alias-name');
    const valueInput = aliasItem.querySelector('.alias-value');
    nameInput.addEventListener('input', updateOutput);
    valueInput.addEventListener('input', updateOutput);

    updateOutput();
}

// Remove alias
function removeAlias(button) {
    const aliasItem = button.closest('.alias-item');
    aliasItem.remove();
    updateOutput();
}

// Copy config to clipboard
function copyConfig() {
    const output = document.getElementById('output').textContent;
    navigator.clipboard.writeText(output).then(() => {
        const btn = document.getElementById('copyBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#4caf50';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

