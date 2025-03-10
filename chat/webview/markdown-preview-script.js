let currentMarkdownFile = null;

// 添加新的函数来更新markdown预览
function updateMarkdownPreview(message) {
    const content = message.content;
    currentMarkdownFile = message.filePath;  // 存储文件路径

    const previewElement = document.getElementById('markdown-preview');
    if (previewElement && content) {
        previewElement.innerHTML = renderMarkdown(content);

        // 为所有可选择的元素添加点击事件
        const selectableElements = previewElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li');
        selectableElements.forEach(element => {
            element.addEventListener('click', handleParagraphClick);
        });
    }
}

let selectedParagraphs = new Set();
const toolbar = document.querySelector('.paragraph-toolbar');

function handleParagraphClick(event) {
    const validElements = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'];
    const clickedElement = event.target;

    if (!validElements.includes(clickedElement.tagName)) {
        return;
    }

    event.stopPropagation();

    // Handle Ctrl/Cmd key for multiple selections
    if (!event.ctrlKey && !event.metaKey) {
        // Clear previous selections if Ctrl/Cmd is not pressed
        selectedParagraphs.forEach(para => {
            para.classList.remove('selected');
        });
        selectedParagraphs.clear();
    }

    // Toggle selection on clicked element
    if (selectedParagraphs.has(clickedElement)) {
        clickedElement.classList.remove('selected');
        selectedParagraphs.delete(clickedElement);
    } else {
        clickedElement.classList.add('selected');
        selectedParagraphs.add(clickedElement);
    }

    // Show/hide toolbar based on selections
    if (selectedParagraphs.size > 0) {
        positionToolbar();
    } else {
        toolbar.style.display = 'none';
    }
}

function positionToolbar() {
    // Get the bounding rectangle of the first selected element
    const firstSelected = selectedParagraphs.values().next().value;
    const rect = firstSelected.getBoundingClientRect();
    const previewElement = document.getElementById('markdown-preview');
    const previewRect = previewElement.getBoundingClientRect();

    toolbar.style.display = 'block';

    // Position horizontally
    const leftPosition = Math.max(previewRect.left, rect.left);
    if (firstSelected.tagName.match(/^H[1-6]$/)) {
        toolbar.style.left = `${rect.right - toolbar.offsetWidth}px`;
    } else {
        toolbar.style.left = `${leftPosition}px`;
    }

    // Position vertically
    const topPosition = rect.top - toolbar.offsetHeight - 5;
    if (topPosition < 0) {
        toolbar.style.top = `${rect.bottom + 5}px`;
    } else {
        toolbar.style.top = `${topPosition}px`;
    }
}

// Update toolbar button handlers for multiple selections
document.getElementById('select-copy-btn').addEventListener('click', () => {
    if (selectedParagraphs.size > 0) {
        const textToCopy = Array.from(selectedParagraphs)
            .map(para => para.textContent)
            .join('\n\n');
        copyToClipboard(textToCopy);
        vscode.window.showInformationMessage('已复制到剪贴板');
    }
});


document.getElementById('ask-btn').addEventListener('click', () => {
    if (selectedParagraphs.size > 0 && currentMarkdownFile) {
        const references = {
            type: "reference",
            source: currentMarkdownFile,
            content: Array.from(selectedParagraphs).map(para => ({
                type: para.tagName.toLowerCase(),  // 记录段落类型（p, h1, h2等）
                content: para.textContent,
                // 可以添加更多上下文信息，例如：
                // - 在文档中的位置
                // - 所属章节
                // - 父元素信息等
            }))
        };

        const timestamp = Date.now();

        window.vscode.postMessage({
            type: 'createReference',
            threadId: window.threadId,
            timestamp: timestamp,
            references: references
        });

        selectedParagraphs.forEach(para => {
            para.classList.remove('selected');
        });
        selectedParagraphs.clear();
        toolbar.style.display = 'none';
    }
});

// Hide toolbar when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('#markdown-preview p') && !event.target.closest('.paragraph-toolbar')) {
        selectedParagraphs.forEach(para => {
            para.classList.remove('selected');
        });
        selectedParagraphs.clear();
        toolbar.style.display = 'none';
    }
});



