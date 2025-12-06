const { ipcRenderer } = require('electron');

const btnSubmit = document.getElementById('btn-submit');
const fileFront = document.getElementById('file-front');
const fileBack = document.getElementById('file-back');
const comments = document.getElementById('comments');
const statusArea = document.getElementById('status-area');
const instructionArea = document.getElementById('instruction-area');
const pkgNameSpan = document.getElementById('pkg-name');

let reportData = null;

// Initialize
async function init() {
    try {
        // Get the data that was passed when window opened
        reportData = await ipcRenderer.invoke('get-report-data');
        console.log("Report Data Loaded:", reportData);
    } catch (e) {
        showStatus("Error loading context: " + e.message, 'error');
    }
}

btnSubmit.addEventListener('click', async () => {
    // Validate
    if (fileFront.files.length === 0) {
        showStatus("Please upload at least one photo (Front of Print).", 'error');
        return;
    }

    if (!comments.value.trim()) {
        showStatus("Please enter a brief description.", 'error');
        return;
    }

    // Disable UI
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Creating Package...";
    showStatus("Gathering files and zipping...", 'success'); // using success style for neutral info

    try {
        const imagePaths = [];
        if (fileFront.files.length > 0) imagePaths.push(fileFront.files[0].path);
        if (fileBack.files.length > 0) imagePaths.push(fileBack.files[0].path);

        const result = await ipcRenderer.invoke('create-support-package', {
            reportData: reportData || {},
            userImages: imagePaths,
            comments: comments.value
        });

        if (result.success) {
            showStatus("Success!", 'success');
            instructionArea.classList.remove('hidden');
            pkgNameSpan.textContent = result.filename;
            btnSubmit.classList.add('hidden');
        } else {
            throw new Error(result.error);
        }

    } catch (err) {
        console.error(err);
        showStatus("Failed to create package: " + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Prepare Support Package";
    }
});

function showStatus(msg, type) {
    statusArea.textContent = msg;
    statusArea.className = ''; // reset
    statusArea.classList.remove('hidden');

    if (type === 'error') {
        statusArea.classList.add('status-error');
    } else {
        statusArea.classList.add('status-success');
    }
}

init();
