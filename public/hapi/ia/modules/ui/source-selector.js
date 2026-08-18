// Fichier: modules/ui/source-selector.js

export class SourceSelector {
    constructor(container, documents, activityName, onChange = null) {
        this.container = container;
        this.documents = documents;
        this.activityName = activityName;
        this.onChange = onChange; // Callback pour mettre à jour les compteurs
        
        this.selectedIds = new Set(['all']); 
        
        this.render();
        if (this.onChange) this.onChange(this.getSelectedSourceObjects());
    }

    getIconForSource(doc) {
        if (doc.id === 'all') return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (doc.type === 'text') return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

        const name = (doc.title || '').toLowerCase();
        if (name.endsWith('.pdf')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        else if (name.match(/\.(doc|docx|odt)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        else if (name.match(/\.(ppt|pptx|odp)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        else if (name.endsWith('.txt')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
        else if (name.match(/\.(jpe?g|png)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
        
        return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'; 
    }

    render() {
        this.container.innerHTML = '';

        const style = document.createElement('style');
        style.innerHTML = `
            .source-selector-wrapper { margin-bottom: 10px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }
            .source-selector-title { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold; margin-bottom: 10px;}
            .source-chips-container { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin; }
            .source-chips-container::-webkit-scrollbar { height: 6px; }
            .source-chips-container::-webkit-scrollbar-thumb { background-color: var(--border-strong); border-radius: 10px; }
            
            .source-chip { 
                display: flex; align-items: center; gap: 8px; padding: 8px 16px; 
                background: var(--page-bg); border: 1px solid var(--border); border-radius: 20px; 
                cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
                font-size: 0.9rem; color: var(--text-muted); font-weight: 600;
            }
            .source-chip:hover { background: var(--border); border-color: var(--border-strong); }
            
            .source-chip.active { 
                background: var(--hapi-green-dark); color: #ffffff; border-color: var(--hapi-green-dark); 
                box-shadow: 0 4px 10px rgba(30, 41, 59, 0.3); 
            }
            .source-chip.active .chip-icon { opacity: 1; }
        `;
        this.container.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.className = 'source-selector-wrapper';
        
        const title = document.createElement('div');
        title.className = 'source-selector-title';
        title.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> Choisissez une ou plusieurs sources :';
        wrapper.appendChild(title);

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'source-chips-container';

        this.documents.forEach(doc => {
            const chip = document.createElement('div');
            chip.className = `source-chip ${this.selectedIds.has(doc.id) ? 'active' : ''}`;
            chip.dataset.id = doc.id;
            
            const icon = this.getIconForSource(doc);
            chip.innerHTML = `<span class="chip-icon">${icon}</span> <span>${doc.title}</span>`;
            
            chip.addEventListener('click', () => {
                if (doc.id === 'all') {
                    this.selectedIds.clear();
                    this.selectedIds.add('all');
                } else {
                    this.selectedIds.delete('all');
                    if (this.selectedIds.has(doc.id)) {
                        this.selectedIds.delete(doc.id);
                        if (this.selectedIds.size === 0) this.selectedIds.add('all');
                    } else {
                        this.selectedIds.add(doc.id);
                        if (this.selectedIds.size === this.documents.length - 1) { 
                            this.selectedIds.clear();
                            this.selectedIds.add('all');
                        }
                    }
                }
                this.updateVisuals(chipsContainer);
                if (this.onChange) this.onChange(this.getSelectedSourceObjects());
            });

            chipsContainer.appendChild(chip);
        });

        wrapper.appendChild(chipsContainer);
        this.container.appendChild(wrapper);
    }

    updateVisuals(container) {
        container.querySelectorAll('.source-chip').forEach(chip => {
            if (this.selectedIds.has(chip.dataset.id)) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // ✅ NOUVEAU : Retourne la liste détaillée des objets sélectionnés (pour les compteurs)
    getSelectedSourceObjects() {
        if (this.selectedIds.has('all')) {
            // Si on choisit l'hybride, on retourne tous les documents détaillés
            return this.documents.filter(d => d.id !== 'all');
        }
        return this.documents.filter(d => this.selectedIds.has(d.id));
    }

    getSelectedContent() {
        if (this.selectedIds.has('all')) {
            return this.documents.find(d => d.id === 'all')?.content || '';
        }
        const selectedDocs = this.documents.filter(d => this.selectedIds.has(d.id));
        return selectedDocs.map(d => d.content).join('\n\n--- [DOCUMENT SUIVANT] ---\n\n');
    }
}