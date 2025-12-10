import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowRight, Check, Plus, ChevronDown } from 'lucide-react';

const ImportWizard = ({ isOpen, onClose, onConfirm, categories, existingBanks, t }) => {
    const [step, setStep] = useState(1);
    const [rawText, setRawText] = useState('');
    const [selections, setSelections] = useState([]); // Array of { id, text, start, end, categoryId, bankId, bankName, isNewBank }
    const [selectionMenu, setSelectionMenu] = useState(null); // { x, y, text, start, end }

    const textContainerRef = useRef(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setRawText('');
            setSelections([]);
            setSelectionMenu(null);
        }
    }, [isOpen]);

    const handleTextSelect = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
            setSelectionMenu(null);
            return;
        }

        const range = selection.getRangeAt(0);
        const container = textContainerRef.current;

        // Ensure selection is within our container
        if (!container || !container.contains(range.commonAncestorContainer)) return;

        // Calculate offset relative to the raw text
        // This is tricky with rendered HTML spans. 
        // Simplified approach: We only allow selection on the raw text first, 
        // OR we render the text as a sequence of spans and plain text.
        // Let's try the simpler approach first: Textarea for input, then a special div for annotation.

        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setSelectionMenu({
            x: rect.left - containerRect.left + (rect.width / 2),
            y: rect.top - containerRect.top - 10,
            text: selection.toString(),
            // We need accurate indices. For now, let's just store the text and handle duplicates later or use a different UI approach
            // A better approach for "Annotator" is to construct the content as a list of tokens.
        });
    };

    // --- Logic for Step 2: Annotation ---
    // To robustly handle selections, we can find the text in the raw string.
    // But if there are multiple occurrences, it's ambiguous. 
    // We will simply search for the first occurrence that isn't already processed? 
    // No, `window.getSelection` is hard to map back to string indices in a complex DOM.
    // Alternative: When user selects text, we get the string. We confirm "Extract all occurrences of 'Warrior'?" or just this one.
    // Let's implement "Extract this string".

    const addSelection = (category, bankId, bankName, isNewBank) => {
        if (!selectionMenu) return;

        const newSelection = {
            id: crypto.randomUUID(),
            text: selectionMenu.text,
            categoryId: category,
            bankId: bankId,
            bankName: bankName,
            isNewBank: isNewBank
        };

        setSelections([...selections, newSelection]);
        setSelectionMenu(null);
        // Clear browser selection
        window.getSelection().removeAllRanges();
    };

    const removeSelection = (id) => {
        setSelections(selections.filter(s => s.id !== id));
    };

    const handleConfirm = () => {
        // 1. Process banks: Create new ones if needed, add options to existing ones.
        // Deduplicate by bankId + optionText to prevent duplicate entries
        const bankMap = new Map();

        selections.forEach(sel => {
            const key = `${sel.bankId}|${sel.text}`;
            if (!bankMap.has(key)) {
                bankMap.set(key, {
                    bankId: sel.bankId,
                    bankName: sel.bankName,
                    categoryId: sel.categoryId,
                    optionText: sel.text,
                    isNewBank: sel.isNewBank
                });
            }
        });

        const processedBanks = Array.from(bankMap.values());

        // 2. Process template content
        let finalContent = rawText;
        // We need to replace text with {{bankId}}. 
        // To avoid replacing parts of other replacements (e.g. replacing "fire" inside "fireman"),
        // sort by length descending.
        // Also, we need to handle multiple occurrences if desired. For now, let's replace ALL occurrences of the extracted text.

        // Group by text to avoid double processing
        const uniqueSelections = [...new Map(selections.map(item => [item.text, item])).values()];

        // Sort by length desc to prevent partial overwrites
        uniqueSelections.sort((a, b) => b.text.length - a.text.length);

        uniqueSelections.forEach(sel => {
            // Simple global replace. Note: simple string replace might be dangerous if special chars.
            // Escape regex special chars
            const escapedText = sel.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedText, 'g');
            finalContent = finalContent.replace(regex, `{{${sel.bankId}}}`);
        });

        onConfirm(finalContent, processedBanks);
        onClose();
    };

    // --- Render Helpers ---

    // Highlighting the text in Step 2
    const renderAnnotatedText = () => {
        if (!rawText) return null;

        // We want to highlight the words that are in `selections`.
        // This is purely visual.
        // We split the text by the selected words? 
        // Easier: Just render the raw text unless we want to show "Already selected" state.
        // For MVP, just showing the raw text is file. The "Selected" list below shows what has been picked.
        // Better: Highlight matched words.

        let parts = [{ text: rawText, type: 'text' }];

        selections.forEach(sel => {
            const newParts = [];
            parts.forEach(part => {
                if (part.type !== 'text') {
                    newParts.push(part);
                    return;
                }

                // Split this part by the selection text
                const split = part.text.split(sel.text);
                for (let i = 0; i < split.length; i++) {
                    if (i > 0) {
                        newParts.push({ text: sel.text, type: 'match', meta: sel });
                    }
                    if (split[i]) {
                        newParts.push({ text: split[i], type: 'text' });
                    }
                }
            });
            parts = newParts;
        });

        return (
            <div
                ref={textContainerRef}
                className="whitespace-pre-wrap leading-relaxed p-4 bg-gray-50 border rounded-lg min-h-[200px] text-lg cursor-text"
                onMouseUp={handleTextSelect}
            >
                {parts.map((part, idx) => (
                    part.type === 'match' ? (
                        <span key={idx} className="bg-indigo-100 text-indigo-700 border-b-2 border-indigo-400 font-medium px-1 rounded-sm relative group">
                            {part.text}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                                {categories[part.meta.categoryId]?.label || part.meta.categoryId} / {part.meta.bankName}
                            </span>
                        </span>
                    ) : (
                        <span key={idx}>{part.text}</span>
                    )
                ))}
            </div>
        );
    };

    const SelectionMenuPopover = () => {
        if (!selectionMenu) return null;

        const [tempBankName, setTempBankName] = useState('');
        const [selectedCat, setSelectedCat] = useState('character');
        const [mode, setMode] = useState('select_cat'); // 'select_cat', 'select_bank'

        // Merge existing banks with newly created banks from this session
        const allBanks = { ...existingBanks };

        // Add temporary banks that were created in this wizard session
        selections.forEach(sel => {
            if (sel.isNewBank && !allBanks[sel.bankId]) {
                allBanks[sel.bankId] = {
                    label: sel.bankName,
                    category: sel.categoryId,
                    options: []
                };
            }
        });

        // Filter banks by selected category
        const catBanks = Object.entries(allBanks).filter(([_, b]) => (b.category || 'other') === selectedCat);

        return (
            <div
                className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-72 overflow-hidden flex flex-col"
                style={{ top: selectionMenu.y, left: selectionMenu.x, transform: 'translate(-50%, -100%)' }}
            >
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center text-xs font-medium text-gray-500">
                    <span>提取 "{selectionMenu.text}" 为...</span>
                    <button onClick={() => setSelectionMenu(null)}><X size={14} /></button>
                </div>

                <div className="p-3">
                    <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1">选择分类</label>
                        <div className="flex flex-wrap gap-1">
                            {Object.values(categories).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCat(cat.id)}
                                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${selectedCat === cat.id
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {cat.label.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-2">
                        <label className="block text-xs text-gray-400 mb-1">归入词库</label>
                        {catBanks.length > 0 && (
                            <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
                                {catBanks.map(([key, bank]) => (
                                    <button
                                        key={key}
                                        onClick={() => addSelection(selectedCat, key, bank.label, false)}
                                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 flex items-center justify-between group"
                                    >
                                        <span className="text-gray-700">{bank.label}</span>
                                        <span className="text-xs text-gray-400 group-hover:text-indigo-500">现有</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 items-center mt-2 pt-2 border-t border-gray-100">
                            <input
                                type="text"
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="新建词库名称..."
                                value={tempBankName}
                                onChange={(e) => setTempBankName(e.target.value)}
                            />
                            <button
                                disabled={!tempBankName}
                                onClick={() => {
                                    // Generate a unique ID for the new bank
                                    const newId = 'bank_' + crypto.randomUUID();
                                    addSelection(selectedCat, newId, tempBankName, true);
                                }}
                                className="bg-indigo-600 text-white p-1 rounded disabled:opacity-50"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">智能导入模版</h2>
                        <div className="text-xs text-gray-500 mt-0.5 space-x-2 flex items-center">
                            <span className={step === 1 ? "text-indigo-600 font-bold" : ""}>1. 粘贴文本</span>
                            <ArrowRight size={12} />
                            <span className={step === 2 ? "text-indigo-600 font-bold" : ""}>2. 划词提取</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 ? (
                        <div className="h-full flex flex-col">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                请粘贴您的 Prompt 文本：
                            </label>
                            <textarea
                                className="flex-1 w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-base leading-relaxed"
                                placeholder="例如：一个身穿机甲的未来战士站在霓虹灯闪烁的街道上..."
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            ></textarea>
                        </div>
                    ) : (
                        <div className="relative min-h-[300px]">
                            <div className="mb-4 bg-blue-50 text-blue-800 px-4 py-3 rounded-md text-sm flex items-start gap-2">
                                <div className="mt-0.5"><div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold">i</div></div>
                                <div>
                                    请用<strong>鼠标选中</strong>文本中的关键词（如角色、物品），在弹出的菜单中将其归类。
                                    <br />
                                    系统将自动把所有匹配的词转换为变量。
                                </div>
                            </div>

                            <div className="relative">
                                {renderAnnotatedText()}
                                <SelectionMenuPopover />
                            </div>

                            <div className="mt-6 border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-bold text-gray-700 mb-3">已提取的变量 ({selections.length})</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selections.map(sel => (
                                        <div key={sel.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full border border-gray-200 shadow-sm text-sm">
                                            <span className="font-medium text-gray-800">{sel.text}</span>
                                            <ArrowRight size={12} className="text-gray-400" />
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${categories[sel.categoryId]?.color ? `bg-${categories[sel.categoryId].color}-100 text-${categories[sel.categoryId].color}-700` : 'bg-gray-200'}`}>
                                                {categories[sel.categoryId]?.label?.split(' ')[0] || sel.categoryId}
                                            </span>
                                            <span className="text-xs text-gray-500">[{sel.bankName}]</span>
                                            <button onClick={() => removeSelection(sel.id)} className="text-gray-400 hover:text-red-500 ml-1">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {selections.length === 0 && (
                                        <span className="text-sm text-gray-400 italic">暂无提取，请在上方选词...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    {step === 1 ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">取消</button>
                            <button
                                disabled={!rawText.trim()}
                                onClick={() => setStep(2)}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                下一步：开始提取
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">上一步</button>
                            <button
                                onClick={handleConfirm}
                                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg shadow hover:bg-green-700 flex items-center gap-2"
                            >
                                <Check size={18} />
                                完成导入
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportWizard;
