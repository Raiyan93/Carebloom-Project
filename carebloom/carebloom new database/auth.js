// auth.js - FIXED NGO LOGIN ISSUE
const SUPABASE_URL = "https://msnjlvqqcbwmyqtlhpda.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbmpsdnFxY2J3bXlxdGxocGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzI1MjUsImV4cCI6MjA3NDkwODUyNX0.WtAEKzrBOuiFwkukO_5uIvX23IiW0uxkLu9VFvdxibI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AuthHelper {
    constructor() {
        this.supabase = supabase;
        this.isProcessingLogin = false; // Add flag to prevent multiple redirects
    }

    async checkEmailExists(email) {
        try {
            console.log('🔍 Checking if email exists:', email);
            
            // Check donor_profiles
            const { data: donorData, error: donorError } = await this.supabase
                .from('donor_profiles')
                .select('email')
                .eq('email', email)
                .maybeSingle();

            if (donorError) {
                console.error('❌ Error checking donor profiles:', donorError);
            }

            if (donorData) {
                console.log('❌ Email exists in donor profiles:', email);
                return true;
            }

            // Check ngo_profiles
            const { data: ngoData, error: ngoError } = await this.supabase
                .from('ngo_profiles')
                .select('contact_email')
                .eq('contact_email', email)
                .maybeSingle();

            if (ngoError) {
                console.error('❌ Error checking NGO profiles:', ngoError);
            }

            if (ngoData) {
                console.log('❌ Email exists in NGO profiles:', email);
                return true;
            }

            console.log('✅ Email is available:', email);
            return false;

        } catch (error) {
            console.error('💥 Error checking email existence:', error);
            return false;
        }
    }

    async checkPhoneExists(phoneNumber, userType = 'donor') {
        try {
            console.log('🔍 Checking if phone number exists:', phoneNumber);
            
            if (!phoneNumber) {
                return false;
            }

            const cleanPhone = phoneNumber.replace(/\D/g, '');

            if (userType === 'donor' || userType === 'both') {
                const { data: donorData, error: donorError } = await this.supabase
                    .from('donor_profiles')
                    .select('phone_number')
                    .eq('phone_number', cleanPhone)
                    .maybeSingle();

                if (donorError) {
                    console.error('❌ Error checking donor phone numbers:', donorError);
                }

                if (donorData) {
                    console.log('❌ Phone number exists in donor profiles:', cleanPhone);
                    return true;
                }
            }

            if (userType === 'ngo' || userType === 'both') {
                const { data: ngoData, error: ngoError } = await this.supabase
                    .from('ngo_profiles')
                    .select('contact_phone')
                    .eq('contact_phone', cleanPhone)
                    .maybeSingle();

                if (ngoError) {
                    console.error('❌ Error checking NGO phone numbers:', ngoError);
                }

                if (ngoData) {
                    console.log('❌ Phone number exists in NGO profiles:', cleanPhone);
                    return true;
                }
            }

            console.log('✅ Phone number is available:', cleanPhone);
            return false;

        } catch (error) {
            console.error('💥 Error checking phone number:', error);
            return false;
        }
    }

    async loginUser(email, password) {
        try {
            if (this.isProcessingLogin) {
                console.log('⏳ Login already in progress, skipping...');
                return;
            }

            this.isProcessingLogin = true;
            console.log('🔐 Attempting login for:', email);
            
            const { data, error } = await this.supabase.auth.signInWithPassword({ 
                email: email, 
                password: password 
            });
            
            if (error) {
                console.error('❌ Login error:', error);
                this.isProcessingLogin = false;
                throw error;
            }

            console.log('✅ Login successful, user ID:', data.user.id);

            // FIX: Check NGO profile FIRST to fix the redirect issue
            const { data: ngoProfile, error: ngoError } = await this.supabase
                .from('ngo_profiles')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle(); // Use maybeSingle instead of single

            console.log('🏢 NGO profile check:', { ngoProfile, ngoError });

            // If user is an NGO, redirect immediately (FIXED)
            if (ngoProfile) {
                console.log('🏢 User is an NGO, redirecting to NGO dashboard');
                this.isProcessingLogin = false;
                window.location.href = 'ngodashboard.html';
                return;
            }

            // If not NGO, check if donor
            const { data: donorProfile, error: donorError } = await this.supabase
                .from('donor_profiles')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle(); // Use maybeSingle instead of single

            console.log('🎯 Donor profile check:', { donorProfile, donorError });

            if (donorProfile) {
                console.log('🎯 User is a donor, redirecting to donor dashboard');
                this.isProcessingLogin = false;
                window.location.href = 'dashboard.html';
                return;
            }

            // If no profile found
            console.log('❓ User has no profile, redirecting to role selection');
            this.isProcessingLogin = false;
            window.location.href = 'DonorOrNgo.html';

        } catch (error) {
            console.error('💥 Login failed:', error);
            this.isProcessingLogin = false;
            
            // Handle case where no profile exists
            if (error.code === 'PGRST116') {
                console.log('❓ User has no profile, redirecting to role selection');
                window.location.href = 'DonorOrNgo.html';
                return;
            }
            
            throw error;
        }
    }

    async signupDonor(userData) {
        try {
            console.log('👤 Starting donor registration...', userData.email);

            // Check if email already exists
            const emailExists = await this.checkEmailExists(userData.email);
            if (emailExists) {
                throw new Error('This email address is already registered. Please use a different email or try logging in.');
            }

            // Check if phone number already exists (if provided)
            if (userData.phoneNumber && userData.phoneNumber.trim() !== '') {
                const phoneExists = await this.checkPhoneExists(userData.phoneNumber, 'donor');
                if (phoneExists) {
                    throw new Error('This phone number is already registered. Please use a different phone number.');
                }
            }

            // Create auth user
            const { data: authData, error: authError } = await this.supabase.auth.signUp({ 
                email: userData.email, 
                password: userData.password 
            });
            
            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('This email address is already registered. Please use a different email or try logging in.');
                }
                throw authError;
            }
            
            if (!authData.user) throw new Error('User creation failed');

            console.log('✅ Auth user created:', authData.user.id);

            // Create donor profile
            const { error: profileError } = await this.supabase.from('donor_profiles').insert([{
                id: authData.user.id,
                first_name: userData.firstName,
                last_name: userData.lastName,
                email: userData.email,
                phone_number: userData.phoneNumber ? userData.phoneNumber.replace(/\D/g, '') : null,
                age: userData.age,
                city: userData.city,
                state: userData.state,
                pin_code: userData.pinCode,
                address: userData.address
            }]);

            if (profileError) throw profileError;

            console.log('✅ Donor profile created');

            // Auto sign in
            const { error: signInError } = await this.supabase.auth.signInWithPassword({
                email: userData.email,
                password: userData.password
            });

            if (signInError) {
                console.warn('⚠️ Auto sign-in failed, but registration successful');
                window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                return;
            }

            console.log('🎉 Donor registration complete, redirecting...');
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error('💥 Donor registration failed:', error);
            throw error;
        }
    }

    async signupNGO(ngoData) {
        try {
            console.log('🏢 Starting NGO registration...', ngoData.email);

            // Check if email already exists
            const emailExists = await this.checkEmailExists(ngoData.email);
            if (emailExists) {
                throw new Error('This email address is already registered. Please use a different email or try logging in.');
            }

            // Check if phone number already exists
            const phoneExists = await this.checkPhoneExists(ngoData.contactNumber, 'ngo');
            if (phoneExists) {
                throw new Error('This phone number is already registered. Please use a different phone number.');
            }

            // Create auth user
            const { data: authData, error: authError } = await this.supabase.auth.signUp({ 
                email: ngoData.email, 
                password: ngoData.password 
            });
            
            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('This email address is already registered. Please use a different email or try logging in.');
                }
                throw authError;
            }
            
            if (!authData.user) throw new Error('User creation failed');

            console.log('✅ Auth user created:', authData.user.id);

            // Create NGO profile
            const { error: profileError } = await this.supabase.from('ngo_profiles').insert([{
                id: authData.user.id,
                ngo_name: ngoData.ngoName,
                org_type: ngoData.orgType,
                registration_number: ngoData.regNumber,
                registration_date: ngoData.regDate,
                address: ngoData.address,
                city: ngoData.city,
                state: ngoData.state,
                pin_code: ngoData.pincode,
                contact_phone: ngoData.contactNumber ? ngoData.contactNumber.replace(/\D/g, '') : null,
                contact_email: ngoData.email,
                website_url: ngoData.website
            }]);

            if (profileError) {
                console.error('❌ NGO profile creation error:', profileError);
                throw profileError;
            }

            console.log('✅ NGO profile created');

            // Auto sign in - FIX: Add delay to ensure profile is committed
            setTimeout(async () => {
                try {
                    const { error: signInError } = await this.supabase.auth.signInWithPassword({
                        email: ngoData.email,
                        password: ngoData.password
                    });

                    if (signInError) {
                        console.warn('⚠️ Auto sign-in failed, but registration successful');
                        window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                        return;
                    }

                    console.log('🎉 NGO registration complete, redirecting to NGO dashboard...');
                    // Direct redirect to avoid login logic issues
                    window.location.href = 'ngodashboard.html';
                    
                } catch (signInError) {
                    console.error('💥 Auto sign-in failed:', signInError);
                    window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                }
            }, 1000); // 1 second delay to ensure profile is created

        } catch (error) {
            console.error('💥 NGO registration failed:', error);
            throw error;
        }
    }

    async checkAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        return session;
    }

    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

    async logoutUser() {
        await this.supabase.auth.signOut();
        window.location.href = 'LoginSignUp.html';
    }
}

// Initialize and expose
window.authHelper = new AuthHelper();
console.log('✅ AuthHelper initialized');