import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        joinClub: resolve(__dirname, 'join-club.html'),
        events: resolve(__dirname, 'events.html'),
        eventReport: resolve(__dirname, 'event-report.html'),
        feedbackForm: resolve(__dirname, 'feedback-form.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        resetPassword: resolve(__dirname, 'reset-password.html'),
        setupPassword: resolve(__dirname, 'setup-password.html'),
        acceptInvite: resolve(__dirname, 'accept-invite.html'),
        admin: resolve(__dirname, 'dashboards/admin.html'),
        staff: resolve(__dirname, 'dashboards/staff.html'),
        hod: resolve(__dirname, 'dashboards/hod.html'),
        student: resolve(__dirname, 'dashboards/student.html'),
      }
    }
  }
})
