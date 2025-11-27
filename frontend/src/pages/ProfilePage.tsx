import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SEO from '@/components/SEO'

const ProfilePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="Profile" description="Manage your profile and settings." />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Manage your account settings and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Profile management functionality will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfilePage
