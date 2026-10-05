const API_BASE = "/api";

export const api = {
  // Document endpoints
  async getDocuments() {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  async uploadDocuments(files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async deleteDocument(id) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete document");
    return res.json();
  },

  getDocumentFileUrl(id) {
    return `${API_BASE}/documents/${id}/file`;
  },

  // Chat endpoints
  async sendMessage({ message, conversation_id, document_id }) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversation_id, document_id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Chat request failed" }));
      throw new Error(err.detail || "Chat request failed");
    }
    return res.json();
  },

  async getConversations() {
    const res = await fetch(`${API_BASE}/chat/conversations`);
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json();
  },

  async getConversation(id) {
    const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
    if (!res.ok) throw new Error("Failed to fetch conversation details");
    return res.json();
  },

  async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
    return res.json();
  },

  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Backend offline");
    return res.json();
  }
};
