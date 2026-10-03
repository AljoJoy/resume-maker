import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const formSchema = z.object({
  resume: z
    .custom<FileList>()
    .refine((files) => files.length > 0, "Please upload your resume."),
  jobDescription: z
    .string()
    .trim()
    .min(1, "Please enter a job description."),
})

type FormData = z.infer<typeof formSchema>

type ResumeAnalysis = {
  match_score: number
  strengths: string[]
  gaps: string[]
  bullet_feedback: {
    original: string
    issue: string
    suggestion: string
  }[]
  summary: string
}

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobDescription: "",
    },
  })

  const onSubmit = async (data: FormData) => {
    const payload = new FormData()
    payload.append("resume", data.resume[0])
    payload.append("job_description", data.jobDescription)

    try {
      setIsSubmitting(true)
      setError(null)
      setSubmitted(false)
      const response = await axios.post<ResumeAnalysis>(
        `${(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api/v1/score_checker/analyze`,
        payload,
      )
      setAnalysis(response.data)
      setSubmitted(true)
    } catch {
      setSubmitted(false)
      setAnalysis(null)
      setError("Unable to analyze your resume. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
      <section className="w-full space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Resume matcher
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Tailor your resume to a role
          </h1>
          <p className="text-muted-foreground">
            Upload your resume and add the job description to get started.
          </p>
        </div>

        <Form {...form}>
          <form
            className="space-y-6"
            encType="multipart/form-data"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="resume"
              render={({ field: { onChange, value: _value, ...field } }) => (
                <FormItem>
                  <FormLabel>Resume</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      accept=".pdf,.doc,.docx"
                      onChange={(event) => onChange(event.target.files)}
                      type="file"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-48 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                      placeholder="Paste the job description here"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Analyzing..." : "Analyze resume"}
            </Button>
            {submitted && (
              <p className="text-sm text-muted-foreground" role="status">
                Your resume was analyzed successfully.
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </form>
        </Form>

        {analysis && (
          <section aria-live="polite" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resume match score</CardTitle>
                <CardDescription>
                  How closely your resume matches the job description.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-5">
                <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-8 border-primary text-2xl font-bold">
                  {analysis.match_score}%
                </div>
                <p className="text-muted-foreground leading-7">
                  {analysis.summary}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
                    {analysis.strengths.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gaps to address</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
                    {analysis.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bullet feedback</CardTitle>
                <CardDescription>
                  Specific suggestions to make your resume bullets stronger.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.bullet_feedback.length > 0 ? (
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-normal">Original bullet</TableHead>
                        <TableHead className="whitespace-normal">Issue</TableHead>
                        <TableHead className="whitespace-normal">Suggested improvement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.bullet_feedback.map((feedback) => (
                        <TableRow key={`${feedback.original}-${feedback.issue}`}>
                          <TableCell className="w-1/3 whitespace-normal break-words align-top">
                            {feedback.original}
                          </TableCell>
                          <TableCell className="w-1/3 whitespace-normal break-words align-top">
                            {feedback.issue}
                          </TableCell>
                          <TableCell className="w-1/3 whitespace-normal break-words align-top">
                            {feedback.suggestion}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No bullet-specific feedback was returned.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </section>
    </main>
  )
}
