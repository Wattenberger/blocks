import { FileBlockProps } from "@githubnext/blocks";
import { Endpoints } from "@octokit/types";
import { ArrowUpRightIcon, GitCommitIcon, GitPullRequestIcon, IssueOpenedIcon, SortDescIcon } from "@primer/octicons-react";
import { Button, ButtonGroup, Label } from "@primer/react";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { timeMonth } from "d3-time";
import { timeFormat } from "d3-time-format";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { tw } from "twind";

const MAX_PAGES = 20;
const MAX_MONTHS = 8;
const months = timeMonth.range(timeMonth.floor(timeMonth.offset(new Date(), -MAX_MONTHS)), new Date())
export default (props: FileBlockProps) => {
  const { context, tree, onRequestGitHubData } = props;
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])
  const [contributors, setContributors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<null | string>(null)

  const onUpdateData = async () => {
    setError(null)
    setIsLoading(true)

    const getPaginatedRes = async (url, params = {}, dateAccessor = (d: any) => d.date) => {
      try {
        console.log(`Loading page ${params?.page || 1} of ${url}`)
        const res = await onRequestGitHubData(url, { ...params, per_page: 100 });
        const lastDate = new Date(dateAccessor(res.slice(-1)[0]))
        if (
          res.length === 100
          && lastDate >= months[0]
          && +(params.page || 1) < MAX_PAGES
        ) {
          const nextRes = await getPaginatedRes(url, {
            ...params,
            page: (params.page || 1) + 1,
          }, dateAccessor);
          return [...res, ...nextRes];
        }
        return res;
      } catch (e) {
        setError(e.message)
        setIsLoading(false);
        return [];
      }
    };
    const allIssues: Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]["data"] = await getPaginatedRes(
      `/repos/${context.owner}/${context.repo}/issues`,
      { state: "all", },
      d => d.created_at
    );
    const allCommits: Endpoints["GET /repos/{owner}/{repo}/commits"]["response"]["data"] = await getPaginatedRes(
      `/repos/${context.owner}/${context.repo}/commits`,
      {},
      d => d.commit.author.date
    );
    const allPRs: Endpoints["GET /repos/{owner}/{repo}/pulls"]["response"]["data"] = await getPaginatedRes(
      `/repos/${context.owner}/${context.repo}/pulls`,
      { state: "all", },
      d => d.created_at
    );

    const getDataPerUser = (
      data: any[],
      userAccessor = (d: any) => d.user.login,
      messageAccessor = (d: any) => d.title || d.body || d.commit.message,
      dateAccessor = (d: any) => d.created_at
    ) => (
      data.reduce((acc, item) => {
        const user = userAccessor(item);
        if (!user || user === "Bot") return acc;
        if (!acc[user]) acc[user] = [];
        acc[user].push({
          message: messageAccessor(item),
          date: dateAccessor(item),
        });
        return acc;
      }, {})
    )
    const committers = getDataPerUser(
      allCommits,
      commit => commit?.author?.login,
      commit => commit.commit.message,
      commit => commit.commit.author.date || "",
    );
    const issueCreators = getDataPerUser(
      allIssues,
      issue => issue?.user?.login,
      issue => issue.title,
      issue => issue.created_at,
    );
    const prCreators = getDataPerUser(
      allPRs,
      pr => pr?.user?.login,
      pr => pr.title,
      pr => pr.created_at,
    );

    let allActivity = {}
    Object.keys(committers).forEach((user) => {
      if (!allActivity[user]) allActivity[user] = []
      allActivity[user] = [...allActivity[user], ...committers[user].map((commit) => ({ ...commit, type: "commit" }))]
    })
    Object.keys(issueCreators).forEach((user) => {
      if (!allActivity[user]) allActivity[user] = []
      allActivity[user] = [...allActivity[user], ...issueCreators[user].map((commit) => ({ ...commit, type: "issue" }))]
    })
    Object.keys(prCreators).forEach((user) => {
      if (!allActivity[user]) allActivity[user] = []
      allActivity[user] = [...allActivity[user], ...prCreators[user].map((pr) => ({ ...pr, type: "pr" }))]
    })

    const contributors = Object.keys(allActivity).map((user) => {
      const activity = allActivity[user]
      const firstActivity = activity.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      const lastActivity = activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      const dataWithDates = activity.map(d => ({ ...d, date: new Date(d.date) }))
      const monthlyContributions = months.map(m => {
        const count = dataWithDates.filter(d => (
          d.date >= m && d.date < timeMonth.offset(m, 1)
        )).length
        return count
      })
      const isNewcomer = new Date(firstActivity.date) >= months.slice(-1)[0]
      const isCodeWarrior = activity.filter(d => d.type === "commit").length > 10
      const isAdministrator = activity.filter(d => ["issue", "pr"].includes(d.type)).length > 10
      const monthsWithActivity = monthlyContributions.filter(c => c > 0)
      const lastMonthActivity = monthlyContributions.slice(-1)[0]
      const getAverage = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
      const averageMonthlyActivity = getAverage(monthsWithActivity)
      const recentMonthlyActivity = monthlyContributions.slice(-3)
      const pastMonthlyActivity = monthlyContributions.slice(0, -3)
      const isRising = lastMonthActivity > averageMonthlyActivity
        && getAverage(pastMonthlyActivity) < getAverage(recentMonthlyActivity)

      return {
        user,
        firstActivity,
        lastActivity,
        activity,
        monthlyContributions,
        isNewcomer,
        isCodeWarrior,
        isAdministrator,
        isRising,
      }
    })
    console.log(contributors)
    const minDate = timeMonth.floor(timeMonth.offset(new Date(), -MAX_MONTHS))
    const recentContributors = contributors.filter((contributor) => (
      new Date(contributor.lastActivity.date).getTime() > minDate.getTime()
    ))
    setContributors(recentContributors)

    let lastMonthsActiveUsers = new Set()
    let alreadyActiveUsers = new Set(
      contributors.filter((user) => {
        return new Date(user.firstActivity) < months[0]
      }).map((user) => user.user)
    )
    const monthData = months.map((month) => {
      const monthName = timeFormat("%b")(month);
      const contributionsDuringMonth = contributors.map((user) => {
        const contributions = user.activity.filter((activity) => {
          const activityDate = new Date(activity.date)
          return activityDate >= month && activityDate < timeMonth.ceil(timeMonth.offset(month, 1))
        })
        if (!contributions.length) return null
        return {
          user: user.user,
          contributions,
        }
      }).filter(Boolean) as { user: string, contributions: any[] }[]
      const contributionsFromNewContributers = contributionsDuringMonth.filter((contribution) => !alreadyActiveUsers.has(contribution.user))
      const contributionsFromExistingContributers = contributionsDuringMonth.filter((contribution) => alreadyActiveUsers.has(contribution.user))
      const contributionsFromNewLastMonth = contributionsDuringMonth.filter((contribution) => lastMonthsActiveUsers.has(contribution.user))

      lastMonthsActiveUsers = new Set([...contributionsFromNewContributers.map((contribution) => contribution.user)])
      contributionsDuringMonth.forEach((contribution) => alreadyActiveUsers.add(contribution.user))
      return {
        monthName,
        monthNameLong: timeFormat("%B %Y")(month),
        contributionsPerUser: contributionsDuringMonth,
        contributionsFromNewContributers,
        contributionsFromExistingContributers,
        contributionsFromNewLastMonth,
      }
    }).slice(1)
    setMonthlyData(monthData)
    setIsLoading(false)
  }

  useEffect(() => {
    onUpdateData()
  }, [])

  const [highlightedUser, setHighlightedUser] = useState(null)

  if (isLoading) return (
    <div className={tw("flex w-full h-full justify-center items-center h-full")}>
      <div className={tw("text-gray-500 italic")}>Loading...</div>
    </div>
  )

  if (error) return (
    <div className={tw("flex w-full h-full justify-center items-center h-full")}>
      <div className={tw("text-red-500")}>Error: {error}</div>
    </div>
  )

  return (
    <div className={tw("w-full h-full flex items-center")}>
      <div className={tw("flex-none h-full overflow-auto")}>
        <div className={tw("p-3 ")}>
          <Timeline data={monthlyData} highlightedUser={highlightedUser} />
        </div>
      </div>
      <div className={tw("flex-1 h-full overflow-auto pb-40 flex justify-center")}>
        <div className={tw("p-3 w-full")}>
          <Contributors data={contributors} highlightedUser={highlightedUser} setHighlightedUser={setHighlightedUser} />

          {/* vertical gradient definition for sparkline */}
          <svg className={tw("absolute w-0 h-0")} viewBox="0 0 1 1">
            <defs>
              <linearGradient id="sparkline-gradient" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#cab5fa" />
                <stop offset="100%" stopColor="#fff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}


type Activity = {
  type: "commit" | "issue" | "pr"
  message: string
  date: string
}
type Contributor = {
  user: string
  firstActivity: string
  lastActivity: string
  activity: Activity[]
  isNewcomer: boolean
  isCodeWarrior: boolean
  isAdministrator: boolean
  isRising: boolean
}
type MonthData = {
  monthName: string
  contributionsPerUser: { user: string, contributions: Activity[] }[]
  contributionsFromNewContributers: { user: string, contributions: Activity[] }[]
  contributionsFromExistingContributers: { user: string, contributions: Activity[] }[]
  contributionsFromNewLastMonth: { user: string, contributions: Activity[] }[]
}

const colorsByTypeByType = {
  all: {
    total: "#d0d7de",
    oldNew: "#1a7f37",
    new: "#4ac26b",
    highlighted: "#a475f9",
  },
  commit: {
    total: "#d0d7de",
    oldNew: "#6639ba",
    new: "#c297ff",
    highlighted: "#a475f9",
  },
  issue: {
    total: "#d0d7de",
    oldNew: "#bc4c00",
    new: "#fb8f44",
    highlighted: "#a475f9",
  },
  pr: {
    total: "#d0d7de",
    oldNew: "#0550ae",
    new: "#54aeff",
    highlighted: "#a475f9",
  },
}
const Timeline = ({ data, highlightedUser }: {
  data: MonthData[]
  highlightedUser: string
}) => {
  const [isContributors, setIsContributors] = useState(true)
  const [type, setType] = useState<"commit" | "issue" | "pr" | null>(null)
  const [focusedMonthIndex, setFocusedMonthIndex] = useState(0)
  const barWrapperElement = useRef(null)
  const [barWrapperHeight, setBarWrapperHeight] = useState(0)

  const colorsByType = colorsByTypeByType[type || "all"]

  useEffect(() => {
    const onResize = () => {
      const { height } = barWrapperElement.current.getBoundingClientRect()
      setBarWrapperHeight(height)
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const filteredData = useMemo(() => {
    const doesMatchType = (activity: Activity) => !type || activity.type === type
    return data.map((month) => {
      const contributionsPerUser = month.contributionsPerUser.map((user) => ({
        ...user,
        contributions: user.contributions.filter((contribution) => doesMatchType(contribution))
      })).filter((user) => user.contributions.length)
      return {
        ...month,
        contributionsPerUser,
        contributionsFromNewContributers: month.contributionsFromNewContributers.map((user) => ({
          ...user,
          contributions: user.contributions.filter((contribution) => doesMatchType(contribution))
        })).filter((user) => user.contributions.length),
        contributionsFromNewLastMonth: month.contributionsFromNewLastMonth.map((user) => ({
          ...user,
          contributions: user.contributions.filter((contribution) => doesMatchType(contribution))
        })).filter((user) => user.contributions.length),
        contributionsFromExistingContributers: month.contributionsFromExistingContributers.map((user) => ({
          ...user,
          contributions: user.contributions.filter((contribution) => doesMatchType(contribution))
        })).filter((user) => user.contributions.length),
        contributionsFromHighlightedUser: !highlightedUser ? []
          : contributionsPerUser.filter((user) => user.user === highlightedUser),
      }
    })
  }, [data, type, highlightedUser])

  const totalAccessor = (d: any) => isContributors ? d.contributionsPerUser.length : d.contributionsPerUser.reduce((acc, item) => acc + item.contributions.length, 0)
  const oldNewAccessor = (d: any, i: number) => {
    const nextMonth = filteredData[i + 1]
    if (!nextMonth) return 0
    return isContributors ? nextMonth.contributionsFromNewLastMonth.length : nextMonth.contributionsFromNewLastMonth.reduce((acc, item) => acc + item.contributions.length, 0)
  }
  const newAccessor = (d: any) => isContributors ? d.contributionsFromNewContributers.length : d.contributionsFromNewContributers.reduce((acc, item) => acc + item.contributions.length, 0)
  const highlightedUserAccessor = (d: any) => isContributors ? d.contributionsFromHighlightedUser.length : d.contributionsFromHighlightedUser.reduce((acc, item) => acc + item.contributions.length, 0)

  const maxTotal = Math.max(...filteredData.map(totalAccessor))
  const { yScale } = useMemo(() => {
    const yScale = scaleLinear()
      .domain([0, maxTotal])
      .range([0, barWrapperHeight])
      .nice()
    return { yScale }
  }, [maxTotal, barWrapperHeight])

  const noun = type || "contribution"

  const focusedMonth = filteredData[focusedMonthIndex]

  return (
    <div className={tw("flex flex-col items-center relative w-full w-[28em]")}>
      <div className={tw("flex w-full justify-center")}>
        <ButtonGroup>
          <Button className={tw("!inline-block")} variant={isContributors ? "primary" : "default"} onClick={() => setIsContributors(true)}>Contributors</Button>
          <Button className={tw("!inline-block")} variant={isContributors ? "default" : "primary"} onClick={() => setIsContributors(false)}>{titleCase(noun)}s</Button>
        </ButtonGroup>
      </div>
      <div className={tw("flex w-full justify-center mt-2")}>
        <ButtonGroup>
          <Button className={tw("!inline-block")} variant={!type ? "primary" : "default"} onClick={() => setType(null)}>All</Button>
          <Button className={tw("!inline-block")} variant={type === "commit" ? "primary" : "default"} onClick={() => setType("commit")}>Commits</Button>
          <Button className={tw("!inline-block")} variant={type === "issue" ? "primary" : "default"} onClick={() => setType("issue")}>Issues</Button>
          <Button className={tw("!inline-block")} variant={type === "pr" ? "primary" : "default"} onClick={() => setType("pr")}>Pull requests</Button>
        </ButtonGroup>
      </div>
      <div className={tw("relative flex w-full h-[16em] my-6 px-2 mt-8 z-20")} ref={barWrapperElement}>
        {filteredData.slice(0, 300).map((d, i) => {
          const total = yScale(totalAccessor(d))
          return (
            <div key={i} className={tw("flex-1 w-10 flex flex-col items-center contents-end relative flex-1 h-full z-20", i === focusedMonthIndex ? "bg-gray-100" : "")} onMouseEnter={() => {
              setFocusedMonthIndex(i)
            }}>
              <div className={tw("relative w-full h-full mt-auto transition-all p-1 pb-0")} style={{
                height: total,
              }}>
                <div className={tw("relative flex-1 h-full rounded-t-xl overflow-hidden transition-all")}
                  style={{
                    backgroundColor: colorsByType.total,
                  }}>
                  {highlightedUser ? (
                    <div className={tw("absolute bottom-0 left-0 right-0 transition-all")}
                      style={{
                        height: Math.round(yScale(highlightedUserAccessor(d))),
                        backgroundColor: colorsByType.highlighted,
                      }}
                    />
                  ) : (
                    <>
                      <div className={tw("absolute bottom-0 left-0 right-0 transition-all")}
                        style={{
                          height: Math.round(yScale(newAccessor(d))),
                          // bottom: `${yScale(oldNewAccessor(d, i))}%`,
                          backgroundColor: colorsByType.new,
                        }}
                      />
                      <div className={tw("absolute bottom-0 left-0 right-0 transition-all")}
                        style={{
                          height: Math.round(yScale(oldNewAccessor(d, i))),
                          backgroundColor: colorsByType.oldNew,
                        }}
                      />
                    </>
                  )}
                </div>
                <div className={tw("absolute top-0 left-0 right-0 transform -translate-y-full text-xs text-center text-gray-500 font-mono")}>
                  {totalAccessor(d) ? totalAccessor(d).toLocaleString() : ""}
                </div>
              </div>
              <div className={tw("w-full p-1 bg-white border-t border-gray-300 text-xs text-center",
                focusedMonthIndex === i ? "text-gray-900 bg-gray-100" : "text-gray-500"
              )}>
                {d.monthName}
              </div>
            </div>
          )
        })}
      </div>
      {
        !!focusedMonth && (
          <div className={tw("text-sm font-medium w-full px-6 leading-tight space-y-2")}>
            <div className={tw("font-semibold text-lg")}>
              {focusedMonth.monthNameLong}
            </div>
            <div className={tw("-mb-1 font-medium text-gray-500")}>
              {totalAccessor(focusedMonth).toLocaleString()} total {isContributors ? "contributors" : `${noun}s`}
            </div>
            {highlightedUser ? (
              <div className={tw("")}
                style={{
                  color: colorsByType.highlighted,
                }}>
                {isContributors
                  ? `${highlightedUser} ${highlightedUserAccessor(focusedMonth) ? `contributed` : "did not contribute"} in ${focusedMonth.monthNameLong.split(" ")[0]}`
                  : `${highlightedUserAccessor(focusedMonth).toLocaleString()} ${noun}s from ${highlightedUser}`}
              </div>

            ) : (
              <>
                <div className={tw("")}
                  style={{
                    color: colorsByType.new,
                  }}>
                  {newAccessor(focusedMonth).toLocaleString()} {isContributors ? "" : `${noun}s from `} new contributors in {focusedMonth.monthNameLong.split(" ")[0]}
                </div>
                <div className={tw("")}
                  style={{
                    color: colorsByType.oldNew,
                  }}>
                  {oldNewAccessor(focusedMonth, focusedMonthIndex).toLocaleString()} {isContributors ? "of which" : `${noun}s from new contributors who`} also contributed the following month {focusedMonthIndex === data.length - 1 && "(stay tuned!)"}
                </div>
              </>
            )}
          </div>
        )
      }
    </div >
  )
}

const newcomerFrieldlyLabels = [
  "first-timers-only",
  "good first issue",
  "jump-in",
  "easy",
  "junior job",
  "help wanted",
  "stat:contributions welcome",
  "low-hanging-fruit",
  "beginner",
  "level:starter",
  "exp/beginner",
  "up for grabs, difficulty/1:easy, tech go",
  "d.firsttimers",
  "onboarding",
  "good-for-beginner",
  "first time contributor",
  "starter bug",
  "easy pick",
  "d0: my first commit (contrib difficulty)",
  "contribution starter",
  "5-good-beginner-bug",
  "up-for-grabs",
  "difficulty:easy",
  "up for grabs, difficulty/1:easy, tech javascript",
  "newbie",
  "good for beginner",
  "beginners only",
  "difficulty/low",
  "easy-pick",
  "first-timers-only",
  "easy",
  "low hanging fruit",
  "difficulty/newcomer",
  "low-hanging fruit",
  "django hacktober special",
  "level:starter",
  "easyfix",
  "starter-issue",
  "beginner",
  "type: jump in",
  "#starter-task",
  "beginner friendly",
  "e-easy",
  "d: easy",
  "nice first contribution",
  "i-good-first-issue",
  "i-help-wanted",
  "tag: beginner friendly",
  "first-timers-only",
  "low-hanging-fruit",
  "level:starter",
  "exp/beginner",
  "for new contributors",
  "good-for-beginner",
  "first time contributor",
  "good for new contributors",
  "first time welcome",
  "good first contribution",
  "good first task",
  "good first bug",
]

const titleCase = (str: string) => (
  str.split(" ").map(s => s[0].toUpperCase() + s.slice(1)).join(" ")
)

const Contributors = ({ data, highlightedUser, setHighlightedUser }: {
  data: Contributor[]
  highlightedUser: string
  setHighlightedUser: (user: string) => void
}) => {
  const [type, setType] = useState<null | "newcomer" | "code warrior" | "admin" | "rising contributor">(null)
  const [sort, setSort] = useState<"total contributions" | "recent">("total contributions")

  const filteredContributors = useMemo(() => {
    let filteredData = data.map((d, i) => ({ ...d, index: i }))
    if (!type) return filteredData
    return filteredData.filter((d, i) => {
      if (type === "newcomer") return d.isNewcomer
      if (type === "code warrior") return d.isCodeWarrior
      if (type === "admin") return d.isAdministrator
      if (type === "rising contributor") return d.isRising
    })
  }, [data, type])

  const sortedContributors = useMemo(() => {
    return filteredContributors.sort((a, b) => {
      if (sort === "total contributions") {
        return b.activity.length - a.activity.length
      }
      if (sort === "recent") {
        return new Date(b.lastActivity.date).getTime() - new Date(a.lastActivity.date).getTime()
      }
    })
  }, [filteredContributors, sort])

  const maxContributionsPerMonth = useMemo(() => (
    Math.max(...data.map(d => Math.max(...d.monthlyContributions)))
  ), [data])

  return (
    <div className={tw("flex flex-col items-center")}>
      <div className={tw("w-full flex items-center justify-between px-2")}>
        <ButtonGroup>
          {[null, "newcomer", "code warrior", "admin", "rising contributor"].map(t => (
            <Button key={t} className={tw("!inline-block")} variant={type === t ? "primary" : "default"} onClick={() => setType(t)}>
              {t ? `${titleCase(t)}s` : "All"}
            </Button>
          ))}
        </ButtonGroup>
        <div className={tw("flex items-center")}>
          <SortDescIcon className={tw("mr-2 text-gray-600")} />
          <ButtonGroup className={tw("ml-auto")}>
            {["total contributions", "recent"].map(s => (
              <Button key={s} className={tw("!inline-block")} variant={sort === s ? "primary" : "default"} onClick={() => setSort(s)}>
                {titleCase(s)}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <div className={tw("w-full flex flex-wrap mt-2 pb-16 grid grid-cols-[repeat(auto-fill,minmax(13em,1fr))]")}>
        <AnimatePresence>
          {sortedContributors.map((d) => {
            const i = d.index
            const isNew = d.isNewcomer
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={tw("flex-1 p-2")}
                onMouseEnter={() => setHighlightedUser(d.user)}
                onMouseLeave={() => setHighlightedUser("")}>
                <div className={tw("flex flex-col items-center w-full p-3 bg-white border border-gray-100 rounded-lg shadow",
                  highlightedUser === d.user && "border-blue-500",
                )}
                >
                  <a href={`https://github.com/${d.user}`} target="_blank" rel="noreferrer">
                    <div className={tw("flex items-center justify-center w-12 h-12 rounded-full overflow-hidden")}>
                      <img src={`https://avatars.githubusercontent.com/${d.user}` as any} className={tw("w-full h-full")} />
                    </div>
                  </a>
                  <div className={tw("mt-2 text-sm font-medium text-center")}>
                    {d.user}
                  </div>
                  {isNew ? (
                    <div className={tw("mt-1 text-sm font-medium text-center text-green-500")}>
                      New contributor
                    </div>
                  ) : (
                    <div className={tw("mt-1 text-sm text-gray-600 text-center")}>
                      Joined {timeFormat("%b %Y")(new Date(d.firstActivity.date))}
                    </div>
                  )}
                  <div className={tw("mt-3 w-full text-sm text-gray-600 flex items-center justify-center space-x-6 font-mono text-xs")}>
                    <div className={tw("flex flex-col items-center")}>
                      <span style={{ color: colorsByTypeByType["commit"]["oldNew"] }}>
                        <GitCommitIcon className={tw("mb-1")} />
                      </span>
                      {d.activity.filter(d => d.type === "commit").length}
                    </div>
                    <div className={tw("flex flex-col items-center")}>
                      <span style={{ color: colorsByTypeByType["issue"]["oldNew"] }}>
                        <IssueOpenedIcon className={tw("mb-1")} />
                      </span>
                      {d.activity.filter(d => d.type === "issue").length}
                    </div>
                    <div className={tw("flex flex-col items-center")}>
                      <span style={{ color: colorsByTypeByType["pr"]["oldNew"] }}>
                        <GitPullRequestIcon className={tw("mb-1")} />
                      </span>
                      {d.activity.filter(d => d.type === "pr").length}
                    </div>
                  </div>
                  <div className={tw("mt-3 w-full flex items-center justify-center min-h-[1.3em]")}>
                    {d.isRising && (
                      <Label variant="done">
                        <ArrowUpRightIcon className={tw("mr-1")} />
                        Rising Contributor
                      </Label>
                    )}
                  </div>
                  <ActivitySparkline data={d.monthlyContributions} maxCount={maxContributionsPerMonth} />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

const ActivitySparkline = ({ data, maxCount = 0 }: { data: number[], maxCount?: number }) => {
  const { linePath, areaPath } = useMemo(() => {
    const yScale = scaleLinear()
      .domain([0, maxCount])
      .range([1, 0])
    const linePath = line()
      .x((d, i) => i)
      .y(yScale)
      .curve(curveMonotoneX)(data)
    const areaPath = area()
      .x((d, i) => i)
      .y0(1)
      .y1(yScale)
      .curve(curveMonotoneX)(data)
    return { linePath, areaPath }
  }, [data])

  return (
    <div className={tw("flex flex-col items-center justify-center w-full h-12 mt-2 text-indigo-500")}>
      <svg viewBox={`0 0 ${MAX_MONTHS} 1`} className={tw("w-full h-[6em] overflow-visible")} preserveAspectRatio="none">
        <path d={areaPath} fill="url(#sparkline-gradient)" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}