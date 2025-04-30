class APIErrorHandler {
    static showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.textContent = `Error: ${message}`;
        errorContainer.style.display = 'block';
        
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    }

    static async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: 'An unknown error occurred'
            }));
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
}
