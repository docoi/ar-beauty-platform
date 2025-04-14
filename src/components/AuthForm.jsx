import { useState } from 'react'
import { supabase } from '../utils/supabaseClient'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('Loading...')
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setMessage(error ? error.message : 'Check your email for confirmation link')
  }

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white p-6 shadow rounded">
      <h2 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Log In'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border px-3 py-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border px-3 py-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-black text-white py-2 rounded">
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
        <p className="text-sm text-gray-500 text-center cursor-pointer" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log in' : 'No account? Sign up'}
        </p>
        <p className="text-sm text-center mt-2">{message}</p>
      </form>
    </div>
  )
}
