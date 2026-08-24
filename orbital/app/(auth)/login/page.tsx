import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Orbital</CardTitle>
        <CardDescription>Sign in with your Google account to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton />
      </CardContent>
    </Card>
  )
}
