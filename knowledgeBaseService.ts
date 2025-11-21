// ...existing code...
export async function listKnowledgeBases(skip = 0, limit = 100) {
    try {
        const response = await fetch(`http://localhost:8000/api/v1/knowledge-bases?skip=${skip}&limit=${limit}`);
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return []; // Return an empty array as a fallback
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch knowledge bases:', error);
        return []; // Return an empty array as a fallback
    }
}
// ...existing code...
