// notifications.js - COMPLETE VERSION WITH ALL FIXES
class NotificationSystem {
    constructor() {
        this.supabase = window.authHelper?.supabase;
        this.currentUser = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            const session = await window.authHelper.checkAuth();
            if (!session) {
                console.log('🔔 No user session found');
                return;
            }
            
            this.currentUser = session.user;
            this.setupRealtimeListeners();
            this.loadUnreadNotifications();
            this.isInitialized = true;
            console.log('🔔 Notification system initialized for user:', this.currentUser.id);
            
            // Create welcome notification
            await this.createNotification({
                user_id: this.currentUser.id,
                title: 'Welcome to CareBloom! 🎉',
                message: 'Your notification system is working correctly.',
                type: 'success'
            });
            
        } catch (error) {
            console.error('🔔 Notification system init failed:', error);
        }
    }

    setupRealtimeListeners() {
        if (!this.supabase || !this.currentUser) return;

        // Listen for new notifications in the database
        this.supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${this.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 New notification from DB:', payload);
                    this.showUINotification(payload.new.title, payload.new.message, payload.new.type);
                }
            )
            .subscribe();
    }

    async createNotification(notificationData) {
        try {
            console.log('🔔 Creating notification:', notificationData);
            
            const { data, error } = await this.supabase
                .from('notifications')
                .insert([{
                    user_id: notificationData.user_id,
                    title: notificationData.title,
                    message: notificationData.message,
                    type: notificationData.type || 'info',
                    related_entity_type: notificationData.related_entity_type,
                    related_entity_id: notificationData.related_entity_id
                }])
                .select();

            if (error) {
                console.error('🔔 Failed to create notification:', error);
                return null;
            }

            console.log('🔔 Notification created successfully:', data[0]);
            return data[0];
            
        } catch (error) {
            console.error('🔔 Error creating notification:', error);
            return null;
        }
    }

    async loadUnreadNotifications() {
        try {
            const { data: notifications, error } = await this.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                console.error('🔔 Failed to load notifications:', error);
                return;
            }

            console.log('🔔 Loaded unread notifications:', notifications?.length);
            
            // Show unread notifications
            notifications?.forEach(notification => {
                this.showUINotification(notification.title, notification.message, notification.type);
            });

        } catch (error) {
            console.error('🔔 Error loading notifications:', error);
        }
    }

    async markAsRead(notificationId) {
        try {
            const { error } = await this.supabase
                .from('notifications')
                .update({ 
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', notificationId);

            if (error) {
                console.error('🔔 Failed to mark notification as read:', error);
            } else {
                console.log('🔔 Notification marked as read:', notificationId);
            }
        } catch (error) {
            console.error('🔔 Error marking notification as read:', error);
        }
    }

    // ========== MANUAL TRIGGER METHODS ==========

    // Manual trigger for donation requests (call this from NGO dashboard)
    async triggerDonationRequestNotification(donationId, ngoName) {
        console.log('🔔 Triggering donation request notification for donation:', donationId);
        
        try {
            // First get the donor ID from the donation
            const { data: donation } = await this.supabase
                .from('donations')
                .select('donor_id')
                .eq('id', donationId)
                .single();

            if (!donation) {
                console.error('🔔 Could not find donation:', donationId);
                return;
            }

            console.log('🔔 Found donor ID:', donation.donor_id);

            // Create notification for the DONOR (not the current NGO user)
            await this.createNotification({
                user_id: donation.donor_id, // Send to donor, not current user
                title: 'New Donation Request 📬',
                message: `${ngoName} has requested your donation item.`,
                type: 'info',
                related_entity_type: 'donation_request',
                related_entity_id: donationId
            });

        } catch (error) {
            console.error('🔔 Error triggering donation request notification:', error);
        }
    }

    // Manual trigger for request status updates (call this from donor dashboard)
    async triggerRequestStatusNotification(requestId, status, donorName) {
        console.log('🔔 Triggering request status notification for request:', requestId);
        
        try {
            // First get the NGO ID from the request
            const { data: request } = await this.supabase
                .from('donation_requests')
                .select('ngo_id')
                .eq('id', requestId)
                .single();

            if (!request) {
                console.error('🔔 Could not find request:', requestId);
                return;
            }

            console.log('🔔 Found NGO ID:', request.ngo_id);

            if (status === 'accepted') {
                await this.createNotification({
                    user_id: request.ngo_id, // Send to NGO, not current donor user
                    title: 'Request Accepted! ✅',
                    message: `${donorName} has accepted your donation request.`,
                    type: 'success',
                    related_entity_type: 'donation_request',
                    related_entity_id: requestId
                });
            } else if (status === 'rejected') {
                await this.createNotification({
                    user_id: request.ngo_id, // Send to NGO, not current donor user
                    title: 'Request Declined ❌',
                    message: `${donorName} has declined your donation request.`,
                    type: 'warning',
                    related_entity_type: 'donation_request',
                    related_entity_id: requestId
                });
            }

        } catch (error) {
            console.error('🔔 Error triggering request status notification:', error);
        }
    }

    // Manual trigger for delivery updates
    async triggerDeliveryNotification(trackingId, status, ngoName) {
        try {
            const { data: tracking } = await this.supabase
                .from('delivery_tracking')
                .select('donor_id')
                .eq('tracking_id', trackingId)
                .single();

            if (!tracking) return;

            if (status === 'delivered') {
                await this.createNotification({
                    user_id: tracking.donor_id,
                    title: 'Delivery Complete! 🎉',
                    message: `Your donation has been successfully delivered to ${ngoName}.`,
                    type: 'success',
                    related_entity_type: 'delivery',
                    related_entity_id: trackingId
                });
            }
        } catch (error) {
            console.error('🔔 Error triggering delivery notification:', error);
        }
    }

    // ========== UI NOTIFICATION METHODS ==========

    showUINotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 
                        type === 'warning' ? 'bg-yellow-500' : 
                        type === 'error' ? 'bg-red-500' : 
                        'bg-blue-500';

        notification.className = `fixed top-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 transform transition-transform duration-300 translate-x-full max-w-sm`;
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 pt-0.5">
                    <i class="fas ${this.getNotificationIcon(type)} text-lg"></i>
                </div>
                <div class="ml-3 flex-1">
                    <p class="font-semibold">${title}</p>
                    <p class="text-sm opacity-90 mt-1">${message}</p>
                </div>
                <button class="ml-4 text-white hover:text-gray-200 flex-shrink-0">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Add click event to close button
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', () => {
            this.removeUINotification(notification);
        });

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                this.removeUINotification(notification);
            }
        }, 5000);
    }

    removeUINotification(notification) {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-exclamation-circle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    // Test method - creates a test notification for current user
    async testNotification() {
        console.log('🔔 Creating test notification...');
        await this.createNotification({
            user_id: this.currentUser.id,
            title: 'Test Notification 🧪',
            message: 'This is a test notification from CareBloom!',
            type: 'info'
        });
    }
}

// Initialize notification system globally
window.notificationSystem = new NotificationSystem();

// Auto-initialize when page loads in dashboards
document.addEventListener('DOMContentLoaded', async () => {

    console.log('🔔 Initializing notification system...');
        setTimeout(() => {
            window.notificationSystem.initialize();
        }, 3000);
        
    if (window.location.pathname.includes('dashboard.html') || 
        window.location.pathname.includes('ngodashboard.html')) {
        
        console.log('🔔 Initializing notification system...');
        setTimeout(() => {
            window.notificationSystem.initialize();
        }, 3000);
    }
});

// Export for testing
console.log('🔔 Notification system loaded');