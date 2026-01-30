/**
 * 自定义预填充扩展 for SillyTavern
 * 
 * 这是一个 SillyTavern (酒馆) 扩展，为多种 LLM 模型自动添加预填充 (Prefill) 属性。
 * 支持额外属性注入（如 Kimi 的 name 字段）和可选的变量替换。
 * 
 * @author Fabulous
 * @version 2.1.0
 */

const multiPrefill = {
    EXTENSION_NAME: "自定义预填充",
    EXTENSION_FOLDER_PATH: "scripts/extensions/third-party/custom-prefill",
    DEBUG: true,

    // Module references
    extension_settings: null,
    saveSettingsDebounced: null,
    eventSource: null,
    event_types: null,
    oai_settings: null,
    chat_completion_sources: null,
    getChatCompletionModel: null,
    getContext: null,

    // Popup module references
    callGenericPopup: null,
    Popup: null,
    POPUP_TYPE: null,
    POPUP_RESULT: null,

    // Preset rules for known providers
    PRESET_RULES: [
        {
            id: "deepseek",
            name: "DeepSeek",
            enabled: true,
            modelPattern: "deepseek",
            prefillProperty: "prefix",
            prefillValue: true,
            extraProperties: {},
            priority: 10
        },
        {
            id: "kimi",
            name: "Kimi (月之暗面)",
            enabled: true,
            modelPattern: "kimi|moonshot",
            prefillProperty: "partial",
            prefillValue: true,
            extraProperties: {},
            priority: 10
        },
        {
            id: "kimi-roleplay",
            name: "Kimi 角色扮演",
            enabled: false,
            modelPattern: "kimi|moonshot",
            prefillProperty: "partial",
            prefillValue: true,
            extraProperties: {
                "name": "{{char}}"
            },
            useVariables: true,
            priority: 5
        }
    ],

    // Default settings
    defaultSettings: {
        globalEnabled: true,
        onlyForCustomSource: true,
        enableVariableSubstitution: false,  // 变量替换默认关闭
        rules: null,  // Will be initialized from PRESET_RULES
        logEnabled: false
    },

    debugLog: function (...args) {
        if (this.DEBUG || this.getSettings().logEnabled) {
            console.log(`[${this.EXTENSION_NAME}]`, ...args);
        }
    },

    initializeSettings: function () {
        if (!this.extension_settings) return;

        try {
            if (!this.extension_settings[this.EXTENSION_NAME]) {
                this.extension_settings[this.EXTENSION_NAME] = Object.assign({}, this.defaultSettings);
                // Deep copy preset rules
                this.extension_settings[this.EXTENSION_NAME].rules = JSON.parse(JSON.stringify(this.PRESET_RULES));
            }

            // Ensure rules exist
            if (!this.extension_settings[this.EXTENSION_NAME].rules) {
                this.extension_settings[this.EXTENSION_NAME].rules = JSON.parse(JSON.stringify(this.PRESET_RULES));
            }

            // Migration: add extraProperties to existing rules if missing
            const rules = this.extension_settings[this.EXTENSION_NAME].rules;
            rules.forEach(rule => {
                if (!rule.extraProperties) {
                    rule.extraProperties = {};
                }
            });

            this.debugLog('Settings initialized:', this.extension_settings[this.EXTENSION_NAME]);
        } catch (e) {
            console.error('[multi-prefill] initializeSettings error:', e);
        }
    },

    getSettings: function () {
        if (!this.extension_settings || !this.extension_settings[this.EXTENSION_NAME]) {
            return this.defaultSettings;
        }
        return this.extension_settings[this.EXTENSION_NAME];
    },

    getRules: function () {
        const settings = this.getSettings();
        return settings.rules || this.PRESET_RULES;
    },

    /**
     * Replace SillyTavern variables in a string
     * Supports: {{char}}, {{user}}, {{persona}}
     */
    replaceVariables: function (str) {
        if (!str || typeof str !== 'string') return str;

        try {
            const context = this.getContext ? this.getContext() : null;
            if (!context) return str;

            let result = str;

            // {{char}} - Character name
            if (context.name2) {
                result = result.replace(/\{\{char\}\}/gi, context.name2);
            }

            // {{user}} - User name
            if (context.name1) {
                result = result.replace(/\{\{user\}\}/gi, context.name1);
            }

            // {{persona}} - Also user name
            if (context.name1) {
                result = result.replace(/\{\{persona\}\}/gi, context.name1);
            }

            return result;
        } catch (e) {
            this.debugLog('Variable replacement error:', e);
            return str;
        }
    },

    updateSettingsUI: function () {
        const settings = this.getSettings();

        jQuery('#multi_prefill_enabled').prop('checked', settings.globalEnabled);
        jQuery('#multi_prefill_custom_only').prop('checked', settings.onlyForCustomSource);
        jQuery('#multi_prefill_variables').prop('checked', settings.enableVariableSubstitution);
        jQuery('#multi_prefill_log').prop('checked', settings.logEnabled);

        this.renderRulesList();
    },

    renderRulesList: function () {
        const rules = this.getRules();
        const container = jQuery('#multi_prefill_rules_list');
        container.empty();

        if (!rules || rules.length === 0) {
            container.html('<div class="no-rules">暂无规则，请添加</div>');
            return;
        }

        rules.forEach((rule, index) => {
            // Format extra properties for display
            let extraPropsDisplay = '';
            if (rule.extraProperties && Object.keys(rule.extraProperties).length > 0) {
                const propsStr = Object.entries(rule.extraProperties)
                    .map(([k, v]) => `${k}: "${v}"`)
                    .join(', ');
                extraPropsDisplay = `
                    <div class="rule-detail">
                        <span class="label">额外属性:</span>
                        <code>${this.escapeHtml(propsStr)}</code>
                    </div>
                `;
            }

            const ruleHtml = `
                <div class="prefill-rule ${rule.enabled ? '' : 'disabled'}" data-index="${index}">
                    <div class="rule-header">
                        <label class="checkbox_label">
                            <input type="checkbox" class="rule-enabled" ${rule.enabled ? 'checked' : ''}>
                            <span class="rule-name">${this.escapeHtml(rule.name)}</span>
                        </label>
                        <div class="rule-actions">
                            <button class="rule-edit menu_button" title="编辑">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="rule-delete menu_button" title="删除">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail">
                            <span class="label">模型匹配:</span>
                            <code>${this.escapeHtml(rule.modelPattern)}</code>
                        </div>
                        <div class="rule-detail">
                            <span class="label">预填充:</span>
                            <code>${this.escapeHtml(rule.prefillProperty)}: ${JSON.stringify(rule.prefillValue)}</code>
                        </div>
                        ${extraPropsDisplay}
                    </div>
                </div>
            `;
            container.append(ruleHtml);
        });
    },

    escapeHtml: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    bindSettingsEvents: function () {
        const self = this;

        // Global enable toggle
        jQuery('#multi_prefill_enabled').on('change', function () {
            const settings = self.getSettings();
            settings.globalEnabled = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Custom source only toggle
        jQuery('#multi_prefill_custom_only').on('change', function () {
            const settings = self.getSettings();
            settings.onlyForCustomSource = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Variable substitution toggle
        jQuery('#multi_prefill_variables').on('change', function () {
            const settings = self.getSettings();
            settings.enableVariableSubstitution = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Debug log toggle
        jQuery('#multi_prefill_log').on('change', function () {
            const settings = self.getSettings();
            settings.logEnabled = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Add preset buttons
        jQuery('#add_deepseek_rule').on('click', function () {
            self.addPresetRule('deepseek');
        });

        jQuery('#add_kimi_rule').on('click', function () {
            self.addPresetRule('kimi');
        });

        jQuery('#add_kimi_roleplay_rule').on('click', function () {
            self.addPresetRule('kimi-roleplay');
        });

        jQuery('#add_custom_rule').on('click', function () {
            self.showAddRuleDialog();
        });

        // Rule list events (delegation)
        jQuery('#multi_prefill_rules_list').on('change', '.rule-enabled', function () {
            const index = jQuery(this).closest('.prefill-rule').data('index');
            const rules = self.getRules();
            if (rules[index]) {
                rules[index].enabled = jQuery(this).prop('checked');
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
                self.renderRulesList();
            }
        });

        jQuery('#multi_prefill_rules_list').on('click', '.rule-edit', function () {
            const index = jQuery(this).closest('.prefill-rule').data('index');
            self.showEditRuleDialog(index);
        });

        jQuery('#multi_prefill_rules_list').on('click', '.rule-delete', function () {
            const index = jQuery(this).closest('.prefill-rule').data('index');
            self.deleteRule(index);
        });
    },

    addPresetRule: function (presetId) {
        const preset = this.PRESET_RULES.find(r => r.id === presetId);
        if (!preset) return;

        const rules = this.getRules();

        // Check if already exists
        if (rules.find(r => r.id === presetId)) {
            toastr.info(`${preset.name} 规则已存在`);
            return;
        }

        rules.push(JSON.parse(JSON.stringify(preset)));
        if (this.saveSettingsDebounced) this.saveSettingsDebounced();
        this.renderRulesList();
        toastr.success(`已添加 ${preset.name} 规则`);
    },

    showAddRuleDialog: function () {
        this.showRuleDialog(null);
    },

    showEditRuleDialog: function (index) {
        const rules = this.getRules();
        if (index >= 0 && index < rules.length) {
            this.showRuleDialog(rules[index], index);
        }
    },

    showRuleDialog: function (existingRule, index) {
        const self = this;
        const isEdit = existingRule !== null;
        const rule = existingRule || {};

        // Format extra properties for display
        let extraPropsStr = '';
        if (rule.extraProperties && Object.keys(rule.extraProperties).length > 0) {
            extraPropsStr = JSON.stringify(rule.extraProperties, null, 2);
        }

        const html = `
            <div class="add-rule-dialog">
                <div class="form-group">
                    <label>规则名称 <span class="required">*</span></label>
                    <input type="text" id="new_rule_name" class="text_pole" value="${this.escapeHtml(rule.name || '')}" placeholder="例如: GLM">
                </div>
                <div class="form-group">
                    <label>模型匹配 (正则) <span class="required">*</span></label>
                    <input type="text" id="new_rule_pattern" class="text_pole" value="${this.escapeHtml(rule.modelPattern || '')}" placeholder="例如: glm|chatglm">
                </div>
                <div class="form-group">
                    <label>预填充属性名 <span class="required">*</span></label>
                    <input type="text" id="new_rule_property" class="text_pole" value="${this.escapeHtml(rule.prefillProperty || 'prefix')}" placeholder="例如: prefix 或 partial">
                </div>
                <div class="form-group">
                    <label>预填充值</label>
                    <select id="new_rule_value" class="text_pole">
                        <option value="true" ${rule.prefillValue === true ? 'selected' : ''}>true (布尔)</option>
                        <option value="false" ${rule.prefillValue === false ? 'selected' : ''}>false (布尔)</option>
                    </select>
                </div>
                <hr>
                <div class="form-group">
                    <label>额外属性 (JSON 格式，可选)</label>
                    <textarea id="new_rule_extra" class="text_pole" rows="3" placeholder='{"name": "角色名"}'>${this.escapeHtml(extraPropsStr)}</textarea>
                    <small>支持变量: {{char}} = 角色名, {{user}} = 用户名</small>
                </div>
                <div class="form-group">
                    <label class="checkbox_label">
                        <input type="checkbox" id="new_rule_use_vars" ${rule.useVariables ? 'checked' : ''}>
                        <span>对此规则启用变量替换</span>
                    </label>
                </div>
            </div>
        `;

        const title = isEdit ? `编辑规则: ${rule.name}` : '添加自定义规则';
        const okButton = isEdit ? '保存' : '添加';

        // Use module reference or global fallback
        const popupType = this.POPUP_TYPE || window.POPUP_TYPE;
        const popupResult = this.POPUP_RESULT || window.POPUP_RESULT;
        const PopupClass = this.Popup || window.Popup;

        if (!PopupClass || !popupType || !popupResult) {
            toastr.error('弹窗模块未加载，请刷新页面重试');
            console.error('[multi-prefill] Popup module not loaded');
            return;
        }

        // Store captured values
        let capturedValues = null;

        // Create popup with onClosing to capture values before DOM removal
        const popup = new PopupClass(html, popupType.CONFIRM, '', {
            okButton: okButton,
            cancelButton: '取消',
            wide: false,
            large: false,
            onClosing: (popup) => {
                // Only capture on affirmative result
                if (popup.result === popupResult.AFFIRMATIVE) {
                    // Capture all form values while DOM still exists
                    capturedValues = {
                        name: jQuery('#new_rule_name').val()?.trim() || '',
                        pattern: jQuery('#new_rule_pattern').val()?.trim() || '',
                        property: jQuery('#new_rule_property').val()?.trim() || '',
                        valueStr: jQuery('#new_rule_value').val() || 'true',
                        extraStr: jQuery('#new_rule_extra').val()?.trim() || '',
                        useVars: jQuery('#new_rule_use_vars').prop('checked') || false
                    };

                    // Validate required fields
                    if (!capturedValues.name || !capturedValues.pattern || !capturedValues.property) {
                        toastr.error('请填写所有必填项');
                        return false; // Prevent closing
                    }

                    // Validate JSON
                    if (capturedValues.extraStr) {
                        try {
                            JSON.parse(capturedValues.extraStr);
                        } catch (e) {
                            toastr.error('额外属性 JSON 格式错误');
                            return false; // Prevent closing
                        }
                    }
                }
                return true; // Allow closing
            }
        });

        popup.show().then((result) => {
            if (result === popupResult.AFFIRMATIVE && capturedValues) {
                // Parse extra properties
                let extraProperties = {};
                if (capturedValues.extraStr) {
                    extraProperties = JSON.parse(capturedValues.extraStr);
                }

                const newRule = {
                    id: isEdit ? rule.id : ('custom_' + Date.now()),
                    name: capturedValues.name,
                    enabled: isEdit ? rule.enabled : true,
                    modelPattern: capturedValues.pattern,
                    prefillProperty: capturedValues.property,
                    prefillValue: capturedValues.valueStr === 'true',
                    extraProperties: extraProperties,
                    useVariables: capturedValues.useVars,
                    priority: rule.priority || 10
                };

                const rules = self.getRules();

                if (isEdit) {
                    rules[index] = newRule;
                    toastr.success(`已更新 ${capturedValues.name} 规则`);
                } else {
                    rules.push(newRule);
                    toastr.success(`已添加 ${capturedValues.name} 规则`);
                }

                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
                self.renderRulesList();
            }
        });
    },

    deleteRule: function (index) {
        const rules = this.getRules();
        if (index >= 0 && index < rules.length) {
            const ruleName = rules[index].name;
            rules.splice(index, 1);
            if (this.saveSettingsDebounced) this.saveSettingsDebounced();
            this.renderRulesList();
            toastr.info(`已删除 ${ruleName} 规则`);
        }
    },

    /**
     * Find a matching rule for the given model name
     */
    findMatchingRule: function (modelName) {
        if (!modelName) return null;

        const rules = this.getRules().filter(r => r.enabled);

        // Sort by priority (lower number = higher priority)
        rules.sort((a, b) => (a.priority || 10) - (b.priority || 10));

        for (const rule of rules) {
            try {
                const pattern = new RegExp(rule.modelPattern, 'i');
                if (pattern.test(modelName)) {
                    this.debugLog(`Model "${modelName}" matched rule "${rule.name}"`);
                    return rule;
                }
            } catch (e) {
                console.error(`[multi-prefill] Invalid regex in rule "${rule.name}":`, e);
            }
        }

        return null;
    },

    /**
     * Handle the CHAT_COMPLETION_PROMPT_READY event
     */
    onChatCompletionPromptReady: function (data) {
        const settings = this.getSettings();

        // Check if extension is enabled
        if (!settings.globalEnabled) {
            return;
        }

        // Check if we should only apply for Custom source
        if (settings.onlyForCustomSource && this.oai_settings && this.chat_completion_sources) {
            if (this.oai_settings.chat_completion_source !== this.chat_completion_sources.CUSTOM) {
                this.debugLog('Skipped: Not using Custom API source');
                return;
            }
        }

        // Get current model name
        let modelName = '';
        if (this.getChatCompletionModel) {
            modelName = this.getChatCompletionModel() || '';
        } else if (this.oai_settings) {
            modelName = this.oai_settings.custom_model || '';
        }

        if (!modelName) {
            this.debugLog('Skipped: Could not determine model name');
            return;
        }

        // Find matching rule
        const rule = this.findMatchingRule(modelName);
        if (!rule) {
            this.debugLog(`No matching rule found for model: ${modelName}`);
            return;
        }

        const messages = data.chat;

        // Check if we have messages and the last one is an assistant message
        if (!messages || !messages.length) {
            return;
        }

        const lastMessage = messages[messages.length - 1];

        if (lastMessage.role === 'assistant') {
            // Apply main prefill property
            if (!lastMessage[rule.prefillProperty]) {
                lastMessage[rule.prefillProperty] = rule.prefillValue;
                this.debugLog(`Applied "${rule.name}" rule: ${rule.prefillProperty} = ${rule.prefillValue}`);
            }

            // Apply extra properties
            if (rule.extraProperties && Object.keys(rule.extraProperties).length > 0) {
                const shouldReplaceVars = settings.enableVariableSubstitution && rule.useVariables;

                for (const [key, value] of Object.entries(rule.extraProperties)) {
                    if (!lastMessage[key]) {
                        let finalValue = value;

                        // Apply variable substitution if enabled
                        if (shouldReplaceVars && typeof value === 'string') {
                            finalValue = this.replaceVariables(value);
                        }

                        lastMessage[key] = finalValue;
                        this.debugLog(`Applied extra property: ${key} = "${finalValue}"`);
                    }
                }
            }

            this.debugLog('Message content:', String(lastMessage.content || '').substring(0, 100) + '...');
        }
    },

    init: function () {
        const self = this;
        this.debugLog('Initializing...');

        // Dynamic imports
        import('../../../extensions.js').then(function (mod) {
            self.extension_settings = mod.extension_settings;
            return import('../../../../script.js');
        }).then(function (mod) {
            self.saveSettingsDebounced = mod.saveSettingsDebounced;
            self.eventSource = mod.eventSource;
            self.event_types = mod.event_types;
            self.getContext = mod.getContext;

            // Load popup module
            return import('../../../popup.js');
        }).then(function (popupMod) {
            // Store popup module references
            self.callGenericPopup = popupMod.callGenericPopup;
            self.Popup = popupMod.Popup;
            self.POPUP_TYPE = popupMod.POPUP_TYPE;
            self.POPUP_RESULT = popupMod.POPUP_RESULT;

            // Also set globals for compatibility
            if (typeof window.callGenericPopup === 'undefined') {
                window.callGenericPopup = popupMod.callGenericPopup;
                window.POPUP_TYPE = popupMod.POPUP_TYPE;
                window.POPUP_RESULT = popupMod.POPUP_RESULT;
            }

            return import('../../../openai.js');
        }).then(function (mod) {
            self.oai_settings = mod.oai_settings;
            self.chat_completion_sources = mod.chat_completion_sources;
            self.getChatCompletionModel = mod.getChatCompletionModel;

            self.debugLog('Modules loaded');
            self.postInit();
        }).catch(function (err) {
            console.error('[multi-prefill] Module load error:', err);
        });
    },

    postInit: function () {
        const self = this;
        this.initializeSettings();

        // Load settings panel HTML
        fetch('/' + this.EXTENSION_FOLDER_PATH + '/settings.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                const container = document.getElementById('extensions_settings2');
                if (container) {
                    container.insertAdjacentHTML('beforeend', html);
                    self.debugLog('Settings panel loaded');
                    self.updateSettingsUI();
                    self.bindSettingsEvents();
                }
            })
            .catch(function (e) {
                console.error('[multi-prefill] Settings panel error:', e);
            });

        // Register for the chat completion prompt ready event
        if (this.eventSource && this.event_types && this.event_types.CHAT_COMPLETION_PROMPT_READY) {
            this.eventSource.on(this.event_types.CHAT_COMPLETION_PROMPT_READY, function (data) {
                self.onChatCompletionPromptReady(data);
            });
            this.debugLog('Registered CHAT_COMPLETION_PROMPT_READY event');
        } else {
            console.error('[multi-prefill] Could not register event');
        }

        this.debugLog('Initialized!');
    }
};

// Initialize when document is ready
jQuery(document).ready(function () {
    setTimeout(function () {
        multiPrefill.init();
    }, 100);
});
