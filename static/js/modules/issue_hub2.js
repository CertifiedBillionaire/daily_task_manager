document.addEventListener('DOMContentLoaded', () => {

    const trashAllBtn = document.getElementById('trashAllBtn');
    const statusFilter = document.getElementById('statusFilter');
    const issuesBody = document.getElementById('issuesBody');

    async function trashAllIssues() {
        if (!confirm('Are you sure you want to trash all visible issues? This can be undone from the Trash tab.')) {
            return;
        }

        if (trashAllBtn) {
            trashAllBtn.disabled = true;
            trashAllBtn.textContent = 'Trashing...';
        }

        const issueRows = issuesBody.querySelectorAll('.grid-row[data-id]');
        const issueIds = Array.from(issueRows).map(row => row.dataset.id);

        if (issueIds.length === 0) {
            toast('No issues to trash.', 'Info', 1500);
            if (trashAllBtn) {
                trashAllBtn.disabled = false;
                trashAllBtn.textContent = 'Trash All';
            }
            return;
        }

        try {
            const responses = await Promise.all(issueIds.map(id =>
                fetch('/api/issuehub/trash', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                })
            ));

            const failed = responses.filter(r => !r.ok);
            if (failed.length > 0) {
                console.error('Failed to trash some issues:', failed);
                toast(`Failed to trash ${failed.length} issues.`, 'Error', 2500);
            } else {
                toast('All issues trashed successfully!', 'Success', 2000);
            }
        } catch (error) {
            console.error('Error trashing all issues:', error);
            toast('An error occurred. Not all issues may have been trashed.', 'Error', 3000);
        } finally {
            loadList();
            if (trashAllBtn) {
                trashAllBtn.disabled = false;
                trashAllBtn.textContent = 'Trash All';
            }
        }
    }

    async function deleteAllIssues() {
        if (!confirm('Are you absolutely sure you want to delete all visible issues permanently? This cannot be undone.')) {
            return;
        }

        if (trashAllBtn) {
            trashAllBtn.disabled = true;
            trashAllBtn.textContent = 'Deleting...';
        }

        const issueRows = issuesBody.querySelectorAll('.grid-row[data-id]');
        const issueIds = Array.from(issueRows).map(row => row.dataset.id);

        if (issueIds.length === 0) {
            toast('No issues to delete.', 'Info', 1500);
            if (trashAllBtn) {
                trashAllBtn.disabled = false;
                trashAllBtn.textContent = 'Delete All';
            }
            return;
        }

        try {
            const responses = await Promise.all(issueIds.map(id =>
                fetch('/api/issuehub/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                })
            ));

            const failed = responses.filter(r => !r.ok);
            if (failed.length > 0) {
                console.error('Failed to delete some issues:', failed);
                toast(`Failed to delete ${failed.length} issues.`, 'Error', 2500);
            } else {
                toast('All issues deleted forever!', 'Success', 2000);
            }
        } catch (error) {
            console.error('Error deleting all issues:', error);
            toast('An error occurred. Not all issues may have been deleted.', 'Error', 3000);
        } finally {
            loadList();
            if (trashAllBtn) {
                trashAllBtn.disabled = false;
                trashAllBtn.textContent = 'Delete All';
            }
        }
    }

    if (trashAllBtn) {
        trashAllBtn.addEventListener('click', () => {
            if (statusFilter.value === 'trash') {
                deleteAllIssues();
            } else {
                trashAllIssues();
            }
        });
    }

});