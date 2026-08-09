/* ========== SLOT GRID ========== */
.slot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    margin-top: 8px;
}

.slot-item {
    padding: 10px 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fff;
    position: relative;
}

.slot-item.available {
    border-color: #d1d5db;
    background: #fff;
}

.slot-item.available:hover {
    border-color: #6b7280;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.slot-item.selected {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.slot-item.unavailable {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.6;
}

.slot-time {
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
    color: #1f2937;
}

.slot-info {
    display: block;
    font-size: 0.7rem;
    color: #6b7280;
    margin-top: 2px;
}

.slot-badge {
    display: inline-block;
    background: #ef4444;
    color: #fff;
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 12px;
    margin-top: 4px;
}

.loading-row {
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    color: #6b7280;
}

.loading-row.error {
    color: #ef4444;
}

/* ========== TOAST ========== */
#toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.toast {
    padding: 14px 20px;
    border-radius: 8px;
    color: #fff;
    font-weight: 500;
    font-size: 0.9rem;
    min-width: 250px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    transition: all 0.3s ease;
}

.toast-success {
    background: #22c55e;
}

.toast-error {
    background: #ef4444;
}

.toast-info {
    background: #3b82f6;
}

.toast-warning {
    background: #f59e0b;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* ========== NAVBAR STYLES ========== */
.navbar {
    display: flex;
    align-items: center;
    margin-left: auto;
    margin-right: 20px;
}

.nav-links {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 8px;
}

.nav-links li a {
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 20px;
    transition: all 0.3s ease;
    letter-spacing: 0.3px;
}

.nav-links li a:hover {
    color: #fff;
    background: rgba(255,255,255,0.1);
}

.nav-links li a.active {
    color: #fff;
    background: rgba(255,255,255,0.15);
}

/* ========== RESPONSIVE ========== */
@media (max-width: 640px) {
    .topbar {
        flex-wrap: wrap;
        padding: 10px 16px;
        gap: 8px;
    }
    
    .navbar {
        order: 3;
        width: 100%;
        margin: 0;
        justify-content: center;
    }
    
    .nav-links {
        gap: 4px;
    }
    
    .nav-links li a {
        font-size: 0.75rem;
        padding: 4px 10px;
    }
    
    .conn-indicator {
        margin-left: auto;
        font-size: 0.7rem;
    }

    .slot-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    }

    .slot-item {
        padding: 8px 6px;
        font-size: 0.8rem;
    }

    .toast {
        min-width: 200px;
        max-width: 300px;
        font-size: 0.8rem;
        padding: 12px 16px;
    }
}
