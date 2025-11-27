import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, FileText, BarChart3, Lock, Clock, Brain } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import SEO from '@/components/SEO'

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <SEO 
        title="Home" 
        image="https://res.cloudinary.com/dwvy7icmo/image/upload/v1764256745/cbt-assets/cbt.png"
      />
      {/* Navbar */}
      <nav className="fixed w-full z-50 top-0 start-0 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-xl text-primary-foreground">C</span>
            </div>
            <span className="self-center text-2xl font-semibold whitespace-nowrap text-foreground">CBT Platform</span>
          </Link>
          <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse items-center">
            <div className="mr-4">
              <ThemeToggle />
            </div>
            <Link to="/login">
              <Button variant="ghost" className="text-foreground hover:text-primary mr-2 hover:bg-accent">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 border-0">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 w-full -translate-x-1/2 h-full z-0 pointer-events-none">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl mix-blend-screen animate-blob"></div>
            <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-purple-500">
            Next-Gen Computer Based <br /> Testing Platform
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            A modern, full-stack assessment solution powered by AI. 
            Create exams from PDFs in seconds, ensure integrity with anti-cheating measures, and get instant, detailed analytics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register">
              <Button size="lg" className="h-14 px-8 text-lg bg-foreground text-background hover:bg-foreground/90 font-semibold rounded-full border-0">
                Start for free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-input text-muted-foreground hover:bg-accent hover:text-foreground rounded-full bg-transparent">
                Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Powerful Features for Modern Assessment</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to conduct secure, efficient, and insightful examinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Brain className="h-8 w-8 text-primary" />}
              title="Flexible Creation"
              description="Create exams your way. Upload PDF question papers for AI parsing or manually craft questions from scratch using our intuitive editor."
            />
            <FeatureCard 
              icon={<Shield className="h-8 w-8 text-emerald-500" />}
              title="Anti-Cheating"
              description="Ensure exam integrity with tab switch detection, fullscreen enforcement, and browser fingerprinting technologies."
            />
            <FeatureCard 
              icon={<BarChart3 className="h-8 w-8 text-amber-500" />}
              title="Advanced Analytics"
              description="Get instant grading, score breakdowns, time analysis, and strength/weakness reports immediately after submission."
            />
            <FeatureCard 
              icon={<FileText className="h-8 w-8 text-blue-500" />}
              title="Flexible Question Types"
              description="Support for Single/Multi MCQ, True/False, Numeric, and Descriptive questions with manual editing capabilities."
            />
            <FeatureCard 
              icon={<Clock className="h-8 w-8 text-rose-500" />}
              title="Smart Timer"
              description="Automated timer management with auto-submit functionality on expiry to ensure fair testing conditions."
            />
            <FeatureCard 
              icon={<Lock className="h-8 w-8 text-purple-500" />}
              title="Secure Access"
              description="Role-based access control (Student/Teacher/Admin) with public, private, or restricted exam settings."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Streamlined Assessment Workflow</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From creation to analysis, we've simplified every step of the examination process.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 z-0"></div>

            <StepCard
              number="01"
              title="Create or Upload"
              description="Start from scratch with manual question entry or simply upload existing PDF papers. Our system handles both with ease."
            />
            <StepCard
              number="02"
              title="Configure & Publish"
              description="Set strict time limits, enable anti-cheating measures, and define grading rules. Publish your exam privately or to a specific group."
            />
            <StepCard
              number="03"
              title="Track & Analyze"
              description="Monitor student progress in real-time. Access detailed performance reports and question-wise analysis immediately after completion."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
              CBT Platform
            </span>
            <p className="text-muted-foreground text-sm mt-2">© 2024 CBT Platform. All rights reserved.</p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 group">
    <div className="mb-4 p-3 bg-accent rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-xl font-semibold text-card-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">
      {description}
    </p>
  </div>
)

const StepCard: React.FC<{ number: string; title: string; description: string }> = ({ number, title, description }) => (
  <div className="relative z-10 bg-card border border-border p-8 rounded-2xl hover:border-primary/50 transition-colors duration-300">
    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary to-purple-600 mb-4 font-mono">
      {number}
    </div>
    <h3 className="text-xl font-semibold text-card-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">
      {description}
    </p>
  </div>
)

export default LandingPage
