import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a senior career advisor specializing in AI/LLM engineering roles in China.

Evaluate each job posting against the candidate's resume using blocks A-G:

Block A: Role classification (function, level, remote_policy)
Block B: Resume match score 1-5 (tech_stack, experience, overall)
Block C: Company analysis (size, funding, business, growth_signal)
Block D: Salary assessment (posted_range, market_assessment: below/at/above)
Block E: 2-4 specific resume tweaks to strengthen the application for THIS role
Block G: Hiring legitimacy check (legitimacy: high/medium/low, ghost_job_signals)

Output ONLY a valid JSON object — no prose, no markdown fences:
{
  "company": string,
  "role": string,
  "url": string,
  "score": number,
  "archetype": string,
  "match_summary": string,
  "cv_suggestions": string[],
  "hard_stops": string[],
  "legitimacy": "high"|"medium"|"low",
  "final_decision": "apply"|"maybe"|"skip"
}`;

export async function evaluateJob(job, cvText) {
  const jdText = job.jd_text ?? job.description ?? '[JD not fetched]';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `## Candidate Resume\n\n${cvText}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `## Job Posting\n\nCompany: ${job.company ?? 'Unknown'}\nRole: ${job.title ?? 'Unknown'}\nURL: ${job.url ?? ''}\nSalary: ${job.salary ?? 'undisclosed'}\nLocation: ${job.location ?? 'unknown'}\n\n${jdText}\n\nEvaluate this posting.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`Unparseable evaluation output:\n${text.slice(0, 300)}`);
  }
}
