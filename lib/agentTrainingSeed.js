/**
 * Default training content. Loaded once if the blob store is empty.
 * Admin panel at /agent-training/admin can override any field.
 */
export const TRAINING_SEED = {
  stages: [
    {
      id: 'stage-1',
      label: 'Stage 1 — Foundation',
      description: 'Core financial concepts every agent must understand before working with clients.',
      modules: [
        {
          id: 'mod-1',
          title: 'Financial Literacy Basics',
          description: 'The foundation of every client conversation starts here.',
          videoUrl: '',
          keyPoints: [
            {
              title: 'Income vs. Expenses — The Foundation',
              summary: 'Spending less than you earn is the single most important financial habit.',
              content: `Every financial journey starts with understanding two numbers: what comes IN and what goes OUT.\n\nIncome is any money you receive — your salary, commissions, bonuses, side income, rental income, or investment returns. Expenses are everything you spend money on — rent, food, transportation, subscriptions, entertainment, and debt payments.\n\nThe wealth gap is simple: INCOME minus EXPENSES = what you keep. The wider that gap, the faster you build wealth. Most people either ignore this or only look at one side.\n\nFixed expenses stay the same every month (rent, car payment, insurance). Variable expenses change (groceries, utilities, gas). Discretionary expenses are choices (dining out, streaming, shopping). You cannot control fixed expenses easily, but you have full control over discretionary spending.\n\nAction step: Write down your top 5 expenses this month. Are they moving you toward your goals, or away from them? Most people are shocked when they see the numbers clearly for the first time.`
            },
            {
              title: 'The 50/30/20 Budget Rule',
              summary: '50% needs, 30% wants, 20% savings and debt payoff — a simple framework that works.',
              content: `The 50/30/20 rule gives you a simple starting framework for every dollar you earn.\n\n50% — Needs: Housing, food, utilities, transportation, minimum debt payments, insurance. These are non-negotiable bills you must pay.\n\n30% — Wants: Dining out, entertainment, travel, subscriptions, shopping, hobbies. These are lifestyle choices, not survival requirements.\n\n20% — Savings and Debt Payoff: Emergency fund, retirement contributions, extra debt payments, investing. This is your future.\n\nReal example with $3,000/month take-home:\n• $1,500 → needs (rent, groceries, car, utilities)\n• $900 → wants (eating out, streaming, fun money)\n• $600 → savings and debt payoff\n\nIf you are carrying high-interest debt, temporarily shift the wants bucket down to 15% and move that extra 15% into aggressive debt repayment. The 50/30/20 rule is a guide — not a law. Adjust it to fit your reality, but always keep the 20% savings habit non-negotiable.`
            },
            {
              title: 'Building Your Emergency Fund',
              summary: '3–6 months of expenses saved before you invest in anything else.',
              content: `An emergency fund is not an investment — it is financial insurance. It protects everything else you are building.\n\nWithout an emergency fund, one unexpected expense (a medical bill, car repair, job loss) forces you into high-interest debt and destroys months of progress. With one, you handle emergencies without breaking stride.\n\nHow much do you need? Calculate your total monthly essential expenses (housing, food, utilities, transportation, minimum payments). Multiply by 3 at minimum, 6 if your income is variable or commission-based.\n\nWhere to keep it: A high-yield savings account, separate from your regular checking account. You want it accessible but not convenient enough to dip into casually. Online banks like Marcus, Ally, or SoFi typically offer 4–5% APY on savings accounts.\n\nHow to build it: Start with $1,000 as your first milestone — this covers most single unexpected expenses. Then automate a transfer every payday until you reach your full target. Treat it like a bill you must pay.\n\nAs an agent in a commission-based business, your emergency fund may need to be on the higher end of 6 months. Variable income requires a larger safety net.`
            },
            {
              title: 'Tackle High-Interest Debt First',
              summary: 'High-interest debt silently steals wealth. Eliminate it before building.',
              content: `Not all debt is created equal. High-interest debt — particularly credit cards with 20–29% APR — is one of the most destructive forces in personal finance.\n\nHere is why it is so dangerous: If you carry a $5,000 credit card balance at 24% interest and only make minimum payments, you will pay over $4,500 in interest alone and it will take more than 10 years to pay off.\n\nTwo proven strategies to eliminate high-interest debt:\n\nThe Debt Avalanche: Pay minimums on all debts, then throw every extra dollar at the highest interest rate first. This saves the most money mathematically.\n\nThe Debt Snowball: Pay minimums on all debts, then attack the smallest balance first regardless of interest rate. This builds psychological momentum — every paid-off account is a win that motivates you to keep going. Research shows this method leads to higher completion rates because of the emotional reward.\n\nChoose the method that keeps you consistent. A plan you actually follow beats a mathematically optimal plan you abandon.\n\nOnce high-interest debt is eliminated, you redirect that payment money directly into savings and investing. That is how you flip the script on compound interest — from working against you to working for you.`
            },
            {
              title: 'Net Worth — Your Real Financial Score',
              summary: 'Net worth = Assets − Liabilities. This number tells the real story.',
              content: `Your income is not your wealth. Your net worth is. You can earn $200,000 a year and have a negative net worth if your liabilities exceed your assets.\n\nAssets are things that hold or gain value: cash, savings accounts, investment accounts, real estate, business equity, life insurance cash value.\n\nLiabilities are things you owe: mortgage balance, car loans, credit card debt, student loans, personal loans.\n\nNet Worth = Total Assets − Total Liabilities\n\nExample:\n• Savings: $8,000\n• 401(k): $22,000\n• Car (current value): $18,000\n• Total Assets: $48,000\n\n• Car loan: $14,000\n• Credit card: $4,500\n• Student loans: $28,000\n• Total Liabilities: $46,500\n\n• Net Worth: $48,000 − $46,500 = $1,500\n\nMost people never calculate this number. Start tracking it. Use a simple spreadsheet and update it every 90 days. Watching your net worth grow — even slowly — is one of the most motivating financial habits you can build.\n\nThe goal is not just to earn more. The goal is to keep more of what you earn and build real, lasting wealth.`
            },
            {
              title: 'Good Debt vs. Bad Debt',
              summary: 'Not all debt takes from you. Some debt is an investment that pays you back — and then some.',
              content: `This concept comes directly from Robert Kiyosaki\'s Rich Dad, Poor Dad — one of the most important financial books ever written.\n\nBad Debt is debt you take on to acquire something that loses value AND costs you money every month. A car is the classic example.\n\nExample of Bad Debt — The Car:\nYou finance a $35,000 car. The moment you drive it off the lot, it loses 20% of its value ($7,000 gone instantly). You now pay $600/month for 5 years ($36,000 total). The car depreciates every year. At the end, you have a used car worth $12,000 and you spent $36,000 to get it. That is money leaving your pocket every single month with no return.\n\nGood Debt is debt you take on to acquire something that generates income or builds equity that exceeds the cost of the debt.\n\nExample of Good Debt — Investing in the Inner Circle:\nYou invest in your Inner Circle membership. You now have access to leads, systems, mentorship, and a team. You write your first few policies. The referral bonuses alone begin covering your investment. Every client you bring in generates ongoing income. The debt (your investment) is paying you back — and more. You are not just spending money; you are buying an income-producing machine.\n\nAnother example: A real estate investor takes a mortgage on a rental property. The rent payments exceed the mortgage payment. The debt is making them money every month.\n\nThe question to ask about ANY financial commitment: Is this taking money out of my pocket, or is it putting money IN my pocket?\n\nRich Dad, Poor Dad teaches this framework powerfully. The poor and middle class buy liabilities thinking they are assets. The wealthy buy assets that generate income. Your job as an agent is to help clients understand this distinction — and to live it yourself.`
            },
            {
              title: 'The Power of Compound Interest',
              summary: 'Einstein called it the eighth wonder of the world. It works for you — or against you.',
              content: 'Albert Einstein allegedly called compound interest the eighth wonder of the world. He said: \'He who understands it, earns it. He who does not, pays it.\' That quote perfectly describes what compound interest does to you depending on which side of the equation you are on.\n\nHow compound interest works: You earn interest on your principal AND on the interest already earned. Over time, this creates exponential growth.\n\nExample — Saving: You invest $5,000 at 7% annual return.\nYear 1: $5,350 (earned $350)\nYear 5: $7,013 (earned $2,013)\nYear 10: $9,836 (earned $4,836)\nYear 20: $19,348 (earned $14,348)\nYear 30: $38,061 (earned $33,061)\n\nYou put in $5,000 and walked away with $38,061. The interest earned more than the original investment. That is compound interest working FOR you.\n\nExample — Debt: You carry a $5,000 credit card balance at 24% APR making only minimum payments. You will pay over $10,000 in total and take 15+ years to pay it off. The interest doubled your debt. That is compound interest working AGAINST you.\n\nThe lesson: Start saving and investing as early as possible. Every year you wait costs you compounding. And eliminate high-interest debt as fast as possible — that interest is compounding against your wealth every single day.'
            },
            {
              title: 'Tax Credits vs. Tax Deductions',
              summary: 'A tax credit cuts your tax bill directly. A deduction only reduces your taxable income.',
              content: 'These two terms are often confused, but the difference is significant and worth knowing — especially when helping clients evaluate financial products.\n\nA Tax Deduction reduces your taxable income. If you are in the 22% tax bracket and you claim a $1,000 deduction, you save $220 in taxes (22% of $1,000). Deductions save you a percentage of their value.\n\nA Tax Credit reduces your actual tax bill dollar-for-dollar. A $1,000 tax credit saves you exactly $1,000 in taxes — regardless of your tax bracket. Credits are more powerful.\n\nCommon Tax Deductions: Mortgage interest, student loan interest, charitable donations, business expenses, 401(k) contributions (traditional), health insurance premiums.\n\nCommon Tax Credits: Child Tax Credit, Earned Income Credit, education credits (American Opportunity Credit), energy-efficient home credits, Child and Dependent Care Credit.\n\nWhy this matters for your clients: When presenting financial products, understanding the tax advantages helps you have a more credible conversation. An IUL, for example, offers tax-FREE growth and tax-free income in retirement — that is not a deduction, it is complete tax avoidance on the growth. Understanding the language of taxes makes you a better advisor.'
            },
            {
              title: '\ud83d\udcda Recommended Reading: Rich Dad, Poor Dad',
              summary: 'The book that changed how millions of people think about money, assets, and financial freedom.',
              pdfUrl: '/resources/rich-dad-poor-dad.pdf',
              content: 'Rich Dad, Poor Dad by Robert T. Kiyosaki is one of the most important personal finance books ever written. If you have not read it, read it. If you have, read it again.\n\nThe core lesson: The poor and middle class work for money. The wealthy make money work for them. The key difference is how they think about assets vs. liabilities, and how they use debt as a tool instead of a trap.\n\nKey concepts from the book:\n\n1. Assets vs. Liabilities: Kiyosaki defines an asset as something that puts money in your pocket. A liability takes money out. A house you live in is a liability. A rental property that generates income is an asset.\n\n2. The Rat Race: Most people trade time for money, use that money to pay bills, then need more money — so they work more. This cycle never creates freedom. Breaking it requires building income-producing assets.\n\n3. Financial Education: Schools teach you to be an employee. They do not teach you how money works, how to invest, how to read a financial statement, or how to build wealth. Your financial education is your responsibility.\n\n4. Working to Learn, Not to Earn: Early in your career, prioritize skills over salary. Learn sales, marketing, accounting, leadership. These skills compound over time.\n\nAs an agent, your ability to talk about money intelligently is your competitive edge. The agents who understand wealth-building concepts — not just insurance products — are the ones clients trust, refer their families to, and come back to for decades.'
            }
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What does "net worth" mean?', options: ['Your annual salary before taxes', 'Assets minus liabilities', 'The total amount you have in savings', 'Your credit score'], correctIndex: 1 },
              { id: 'q2', text: 'According to the 50/30/20 rule, what percentage goes toward savings and debt?', options: ['10%', '30%', '20%', '50%'], correctIndex: 2 },
              { id: 'q3', text: 'How many months of expenses should an emergency fund cover?', options: ['1–2 months', '3–6 months', '12 months', '6–12 months'], correctIndex: 1 },
              { id: 'q4', text: 'Which type of debt is typically most urgent to address first?', options: ['Student loans', 'Mortgage debt', 'High-interest credit card debt', 'Car loans'], correctIndex: 2 },
              { id: 'q5', text: 'What is the difference between gross income and net income?', options: ['They are the same thing', 'Net income is after taxes and deductions', 'Gross income is your take-home pay', 'Net income includes bonuses'], correctIndex: 1 },
              { id: 'q6', text: 'Which is more valuable for reducing your tax bill: a tax credit or a tax deduction?', options: ['Tax deduction — it eliminates all taxes', 'They are exactly equal', 'Tax credit — it reduces taxes dollar-for-dollar', 'Depends on your income level only'], correctIndex: 2 },
              { id: 'q7', text: 'What is a "liquid asset"?', options: ['An asset in a savings account only', 'An asset that can quickly be converted to cash', 'Any investment account', 'Cash hidden at home'], correctIndex: 1 },
              { id: 'q8', text: 'What is the purpose of a credit score?', options: ['To measure your total net worth', 'To track your savings progress', 'To measure creditworthiness for lenders', 'To calculate your tax bracket'], correctIndex: 2 },
              { id: 'q9', text: 'When compound interest works against you, what situation are you in?', options: ['Saving money in a high-yield account', 'Carrying high-interest debt', 'Investing in index funds', 'Building an emergency fund'], correctIndex: 1 },
              { id: 'q10', text: 'If you consistently spend more than you earn, what is the result?', options: ['You build credit quickly', 'You accumulate wealth over time', 'You accumulate debt', 'Your net worth stays neutral'], correctIndex: 2 }
            ]
          }
        },
        {
          id: 'mod-2',
          title: 'Building Wealth Concepts',
          description: 'Understanding how wealth is created and sustained over time.',
          videoUrl: '',
          keyPoints: [
            'Assets put money in your pocket; liabilities take money out.',
            'Wealth is built through consistent saving, smart investing, and time.',
            'Multiple income streams reduce financial risk significantly.',
            'Passive income is money earned with minimal active effort.',
            'Index funds offer broad diversification at low cost.',
            'Time in the market generally beats trying to time the market.',
            'Dollar-cost averaging — investing a fixed amount regularly — removes emotion from investing.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What is the primary difference between an asset and a liability?', options: ['Assets are physical; liabilities are digital', 'Assets generate value or income; liabilities create expenses', 'Assets are only real estate', 'Liabilities are always bad investments'], correctIndex: 1 },
              { id: 'q2', text: 'What does "passive income" mean?', options: ['Income from a second job', 'Income from government benefits', 'Money earned with minimal active effort', 'Money earned only from stocks'], correctIndex: 2 },
              { id: 'q3', text: 'Why is starting to invest early so important?', options: ['Early investors get government tax exemptions', 'More time for compound growth to work', 'Investment fees are lower when you are young', 'Markets always go up in the early years'], correctIndex: 1 },
              { id: 'q4', text: 'What is diversification?', options: ['Putting all money in one high-performing stock', 'Spreading investments to reduce risk', 'Investing only in real estate', 'Keeping savings in multiple bank accounts'], correctIndex: 1 },
              { id: 'q5', text: 'What are index funds?', options: ['Funds managed by Wall Street experts', 'Funds that only invest in government bonds', 'Funds that track a market index like the S&P 500', 'High-risk speculative investments'], correctIndex: 2 },
              { id: 'q6', text: 'Which of the following is the best example of a wealth-building asset?', options: ['A personal car with monthly payments', 'Credit card debt', 'Rental property generating income', 'An expensive vacation'], correctIndex: 2 },
              { id: 'q7', text: 'What does "time in the market" mean?', options: ['How long each trading session lasts', 'Staying invested long-term instead of trying to time market moves', 'The hours the stock market is open', 'How long you work before retiring'], correctIndex: 1 },
              { id: 'q8', text: 'What is dollar-cost averaging?', options: ['Buying stocks only when prices are low', 'Investing a fixed amount regularly regardless of market price', 'Averaging the price of multiple assets', 'Timing your investments to market peaks'], correctIndex: 1 },
              { id: 'q9', text: 'Which of the following is an example of a liability?', options: ['A dividend-paying stock', 'A savings account', 'A car loan with monthly payments', 'A rental property'], correctIndex: 2 },
              { id: 'q10', text: 'What is the first step to building wealth?', options: ['Open a brokerage account immediately', 'Spend less than you earn', 'Invest in cryptocurrency', 'Get as many credit cards as possible'], correctIndex: 1 }
            ]
          }
        },
        {
          id: 'mod-3',
          title: 'Rule of 72',
          description: 'A simple formula that shows clients the power of interest rates at a glance.',
          videoUrl: '',
          keyPoints: [
            'The Rule of 72 estimates how long it takes to double money at a given interest rate.',
            'Formula: 72 ÷ Interest Rate = Years to Double.',
            'At 6% interest: 72 ÷ 6 = 12 years to double.',
            'At 12% interest: 72 ÷ 12 = 6 years to double.',
            'Works in reverse — high-interest debt doubles faster too.',
            'Use it to compare investment options quickly during a client conversation.',
            'It applies to any consistent compound growth rate.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What is the Rule of 72 used for?', options: ['Calculating tax brackets', 'Estimating how long it takes to double an investment', 'Determining monthly mortgage payments', 'Setting retirement contribution limits'], correctIndex: 1 },
              { id: 'q2', text: 'Using the Rule of 72, at 8% interest, how many years does it take to double?', options: ['7 years', '8 years', '9 years', '10 years'], correctIndex: 2 },
              { id: 'q3', text: 'Using the Rule of 72, at 6% interest, how many years to double?', options: ['10 years', '12 years', '8 years', '6 years'], correctIndex: 1 },
              { id: 'q4', text: 'Using the Rule of 72, at 12% interest, how many years to double?', options: ['12 years', '8 years', '4 years', '6 years'], correctIndex: 3 },
              { id: 'q5', text: 'How do you calculate years to double using the Rule of 72?', options: ['Multiply 72 by the interest rate', 'Divide the interest rate by 72', 'Divide 72 by the interest rate', 'Add 72 to the interest rate'], correctIndex: 2 },
              { id: 'q6', text: 'A credit card charges 24% interest. Using the Rule of 72, how fast does that debt double?', options: ['6 years', '3 years', '4 years', '8 years'], correctIndex: 1 },
              { id: 'q7', text: 'What type of growth does the Rule of 72 apply to?', options: ['Simple interest only', 'Compound growth', 'Inflation rates only', 'Stock dividends only'], correctIndex: 1 },
              { id: 'q8', text: 'At a 3% return, how long does it take to double?', options: ['36 years', '24 years', '18 years', '30 years'], correctIndex: 1 },
              { id: 'q9', text: 'Why is the Rule of 72 a powerful tool in client conversations?', options: ['It replaces the need for a financial calculator', 'It quickly illustrates the real impact of interest rates', 'It is required by law to disclose', 'It calculates exact returns'], correctIndex: 1 },
              { id: 'q10', text: 'If an investment doubles in 9 years, what is the approximate interest rate?', options: ['6%', '10%', '8%', '9%'], correctIndex: 2 }
            ]
          }
        },
        {
          id: 'mod-4',
          title: '401(k) Education',
          description: 'What agents need to know about employer-sponsored retirement plans to have credible client conversations.',
          videoUrl: '',
          keyPoints: [
            'A 401(k) is an employer-sponsored retirement savings account.',
            'Traditional 401(k): pre-tax contributions, taxed on withdrawal. Roth 401(k): post-tax, tax-free withdrawal.',
            'Employer match is free money — always contribute enough to capture the full match.',
            '2024 contribution limits: $23,000 (under 50), $30,500 (50+ with catch-up).',
            'Funds grow tax-deferred until withdrawal — early withdrawal before age 59½ triggers a 10% penalty plus taxes.',
            'Key weakness: direct market exposure — a market crash near retirement can devastate savings.',
            'An IUL can complement or outperform a 401(k) by offering tax-free income and downside protection.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What type of account is a 401(k)?', options: ['A personal savings account', 'An employer-sponsored retirement savings account', 'A government-funded pension', 'A health savings account'], correctIndex: 1 },
              { id: 'q2', text: 'What is an employer match?', options: ['When an employer pays your taxes for you', 'When your employer contributes to your 401(k) based on your contributions', 'When two employers share the same plan', 'A government incentive for small businesses'], correctIndex: 1 },
              { id: 'q3', text: 'At what age can you withdraw from a 401(k) without early withdrawal penalty?', options: ['55', '62', '59½', '65'], correctIndex: 2 },
              { id: 'q4', text: 'What penalty applies to early 401(k) withdrawals?', options: ['5% penalty only', '10% penalty plus income taxes', '20% flat tax', 'No penalty if you pay it back'], correctIndex: 1 },
              { id: 'q5', text: 'What is the 2024 401(k) contribution limit for someone under 50?', options: ['$19,500', '$20,500', '$22,000', '$23,000'], correctIndex: 3 },
              { id: 'q6', text: 'What is the main difference between a Traditional and Roth 401(k)?', options: ['Roth has higher contribution limits', 'Traditional contributions are pre-tax; Roth contributions are post-tax', 'Traditional is for employees; Roth is for self-employed', 'There is no meaningful difference'], correctIndex: 1 },
              { id: 'q7', text: 'Why is it critical to contribute at least enough to get the full employer match?', options: ['It raises your credit score', 'It is required by law', 'It is effectively free money added to your retirement', 'It reduces your student loan payments'], correctIndex: 2 },
              { id: 'q8', text: 'What is a key risk of relying solely on a 401(k) for retirement?', options: ['Contribution limits are too high', 'Funds are locked until age 70', 'A market crash near retirement can drastically reduce savings', 'Employer matches are taxable income'], correctIndex: 2 },
              { id: 'q9', text: 'What key advantage does an IUL have over a 401(k)?', options: ['Higher contribution limits', 'Tax-free income and downside market protection', 'Faster vesting schedule', 'Guaranteed employer match'], correctIndex: 1 },
              { id: 'q10', text: 'What does "tax-deferred" mean in the context of a 401(k)?', options: ['You never pay taxes on retirement funds', 'You pay taxes when withdrawing, not when contributing', 'The government defers your taxes indefinitely', 'Taxes are paid by the employer'], correctIndex: 1 }
            ]
          }
        }
      ]
    },
    {
      id: 'stage-2',
      label: 'Stage 2 — Client Conversations',
      description: 'How to connect with clients, present solutions, and guide them to decisions.',
      modules: [
        {
          id: 'mod-5',
          title: 'Needs Analysis & Finding the "Why"',
          description: 'The most important skill in every client conversation.',
          videoUrl: '',
          keyPoints: [
            'Needs analysis discovers what the client truly needs — not just what they say they want.',
            'Ask open-ended questions: "What keeps you up at night financially?"',
            'The "why" is the emotional driver behind every financial decision.',
            'Common whys: family protection, leaving a legacy, retirement security, breaking the cycle.',
            'Never assume — ask, listen, then present.',
            'A deep "why" creates long-term client loyalty and referrals.',
            'Document client goals so every future conversation stays connected to their purpose.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What is the purpose of a needs analysis?', options: ['To immediately recommend the most expensive product', 'To discover what a client truly needs financially', 'To qualify the client for a loan', 'To collect the client\'s financial statements'], correctIndex: 1 },
              { id: 'q2', text: 'What type of questions best uncover a client\'s real needs?', options: ['Closed yes/no questions', 'Multiple choice questions', 'Open-ended questions', 'Technical financial questions'], correctIndex: 2 },
              { id: 'q3', text: 'What does "finding the client\'s why" mean?', options: ['Finding out how much money they have', 'Discovering their emotional motivation for making a financial decision', 'Getting their social security number', 'Determining their investment timeline'], correctIndex: 1 },
              { id: 'q4', text: 'Which question is best for starting a needs analysis?', options: ['"How much can you afford per month?"', '"Do you have life insurance?"', '"What are your biggest financial concerns right now?"', '"Have you ever invested before?"'], correctIndex: 2 },
              { id: 'q5', text: 'Why is the "why" so important in a sales conversation?', options: ['It determines the product price', 'It is required by compliance', 'It drives the client\'s motivation to take action', 'It establishes your credibility'], correctIndex: 2 },
              { id: 'q6', text: 'What is the most common mistake agents make during needs analysis?', options: ['Asking too many questions', 'Talking too much instead of listening', 'Using too many financial terms', 'Starting with product features'], correctIndex: 1 },
              { id: 'q7', text: 'What should you do after discovering a client\'s "why"?', options: ['Close immediately', 'Move to product features right away', 'Reference it throughout the conversation and when presenting solutions', 'Write it down and never mention it again'], correctIndex: 2 },
              { id: 'q8', text: 'Which of the following is NOT a good needs analysis question?', options: ['"What does financial security look like for your family?"', '"If something happened to you tomorrow, would your family be okay?"', '"Don\'t you think you need more life insurance?"', '"What are your long-term financial goals?"'], correctIndex: 2 },
              { id: 'q9', text: 'How does understanding a client\'s "why" help when they raise objections?', options: ['It allows you to lower the price', 'It reminds the client of their real reason for taking action', 'It eliminates all objections automatically', 'It gives you legal protection'], correctIndex: 1 },
              { id: 'q10', text: 'Why is it important to document client goals?', options: ['It is required by state insurance law', 'To charge higher premiums later', 'So every future conversation stays connected to their purpose and goals', 'To share their information with other agents'], correctIndex: 2 }
            ]
          }
        },
        {
          id: 'mod-6',
          title: 'Mortgage Protection',
          description: 'Protecting families from losing their home is one of the most powerful conversations you can have.',
          videoUrl: '',
          keyPoints: [
            'Mortgage protection insurance ensures the home is paid off if the policyholder dies.',
            'It protects the family from losing their home during the worst moment of their lives.',
            'Term life insurance is most commonly used for mortgage protection.',
            'Coverage should match or slightly exceed the outstanding mortgage balance.',
            'Private mortgage protection is often more flexible and affordable than bank-offered options.',
            'Beneficiaries receive a lump sum to pay off the mortgage or continue payments.',
            'Mortgage protection is one of the most natural entry points into a client financial conversation.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What is the primary purpose of mortgage protection insurance?', options: ['To pay off all debt if the client gets sick', 'To ensure the mortgage is paid off if the policyholder dies', 'To replace income if the client loses their job', 'To cover home repairs and maintenance'], correctIndex: 1 },
              { id: 'q2', text: 'What type of insurance is most commonly used for mortgage protection?', options: ['Whole life insurance', 'Universal life insurance', 'Term life insurance', 'Variable annuity'], correctIndex: 2 },
              { id: 'q3', text: 'Who directly benefits from a mortgage protection policy?', options: ['The mortgage lender', 'The insurance company', 'The policyholder\'s family and beneficiaries', 'The real estate agent'], correctIndex: 2 },
              { id: 'q4', text: 'How should coverage amount generally relate to the mortgage?', options: ['It should be double the mortgage amount', 'It should match or slightly exceed the outstanding balance', 'It should be exactly $500,000 always', 'Coverage amount does not matter'], correctIndex: 1 },
              { id: 'q5', text: 'Why is private mortgage protection often better than what the bank offers?', options: ['Banks cannot legally sell insurance', 'Private options are more flexible and often more affordable', 'Bank insurance is always more expensive by law', 'Private options require no medical exam'], correctIndex: 1 },
              { id: 'q6', text: 'What is the best opening question to start a mortgage protection conversation?', options: ['"What is your monthly mortgage payment?"', '"How long have you lived there?"', '"If something happened to you, could your family keep the home?"', '"Are you interested in life insurance?"'], correctIndex: 2 },
              { id: 'q7', text: 'What does the beneficiary typically receive from a mortgage protection policy?', options: ['Monthly payments equal to the mortgage', 'A lump sum payment', 'The deed to the home automatically', 'A credit to the mortgage account only'], correctIndex: 1 },
              { id: 'q8', text: 'When is the best time to discuss mortgage protection with a prospect?', options: ['When they are renting and planning to buy', 'When they already have a mortgage or are buying a home', 'Only at age 65 or older', 'Only when they come to you asking about it'], correctIndex: 1 },
              { id: 'q9', text: 'Mortgage protection is best described as:', options: ['A type of homeowner\'s insurance', 'A government-required policy for all homeowners', 'A life insurance policy tied to home ownership', 'A savings account for mortgage payments'], correctIndex: 2 },
              { id: 'q10', text: 'As a mortgage is paid down over time, what happens to a declining mortgage protection policy?', options: ['The premium increases to match market value', 'Coverage may decrease to match the remaining balance', 'The policy converts to whole life automatically', 'Nothing changes — coverage stays fixed'], correctIndex: 1 }
            ]
          }
        },
        {
          id: 'mod-7',
          title: 'Retirement Education',
          description: 'Equip clients with the knowledge to make better decisions about their financial future.',
          videoUrl: '',
          keyPoints: [
            'Social Security alone is not enough — it typically replaces only about 40% of pre-retirement income.',
            'Most experts recommend 70–90% of pre-retirement income to maintain lifestyle in retirement.',
            '"Sequence of returns" risk: a market crash early in retirement can devastate savings permanently.',
            'An IUL offers tax-free retirement income with downside protection — no direct market exposure.',
            'Diversifying retirement income sources (IUL, 401k, Social Security) reduces overall risk.',
            'IUL cash value grows linked to a market index without the direct risk of market loss.',
            'Starting retirement planning early dramatically improves outcomes — time is the greatest asset.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'Is Social Security alone typically enough to fund retirement?', options: ['Yes — Social Security was designed to fully replace income', 'No — it typically replaces only about 40% of income', 'Yes for most Americans earning under $75,000', 'No — Social Security is being eliminated soon'], correctIndex: 1 },
              { id: 'q2', text: 'What percentage of pre-retirement income do most experts recommend for a comfortable retirement?', options: ['50–60%', '100–110%', '70–90%', '40–50%'], correctIndex: 2 },
              { id: 'q3', text: 'What is "sequence of returns" risk?', options: ['The risk that your broker gives bad advice', 'The risk that poor early returns in retirement permanently reduce long-term savings', 'The risk of investing in the wrong sequence of assets', 'The risk of making too many withdrawals'], correctIndex: 1 },
              { id: 'q4', text: 'What makes an IUL attractive for retirement planning?', options: ['It has higher contribution limits than a 401(k)', 'It offers tax-free income and downside market protection', 'It guarantees a 10% annual return', 'Employers are required to match contributions'], correctIndex: 1 },
              { id: 'q5', text: 'What is the key advantage of tax-free retirement income?', options: ['It increases your Social Security benefit', 'You keep more of what you have saved', 'It eliminates the need for any other retirement account', 'It allows unlimited contributions'], correctIndex: 1 },
              { id: 'q6', text: 'When is the best time to start planning for retirement?', options: ['At age 50 when you can see the finish line', 'At age 40 — the standard starting point', 'As early as possible — time is the greatest asset', 'When your employer starts offering a 401(k)'], correctIndex: 2 },
              { id: 'q7', text: 'How does IUL growth differ from 401(k) growth?', options: ['IUL has higher fees and lower returns', '401(k) has no market risk whatsoever', 'IUL is linked to a market index without direct exposure; 401(k) has direct market risk', 'They are structured identically'], correctIndex: 2 },
              { id: 'q8', text: 'What is a defined benefit pension plan?', options: ['A plan where the employee decides their own benefit', 'An employer-guaranteed retirement income plan', 'A 401(k) plan with employer match', 'A government savings bond program'], correctIndex: 1 },
              { id: 'q9', text: 'Why do most people underestimate how much they need for retirement?', options: ['They overestimate their investment returns', 'They underestimate lifespan and healthcare costs', 'They save too much in their 30s', 'They rely too heavily on IUL products'], correctIndex: 1 },
              { id: 'q10', text: 'What does "income in retirement" mean?', options: ['Your salary from a part-time job after 65', 'Regular payments that replace your working income after you stop working', 'Only Social Security payments', 'A one-time lump sum at retirement'], correctIndex: 1 }
            ]
          }
        },
        {
          id: 'mod-8',
          title: 'Sales Process & Client Conversations',
          description: 'The step-by-step process that takes a prospect from curious to committed.',
          videoUrl: '',
          keyPoints: [
            'Sales process: Approach → Needs Analysis → Presentation → Close → Follow-Up.',
            'Build rapport before presenting any product — people buy from people they trust.',
            'Always tie your solution back to the client\'s stated "why."',
            'A strong presentation addresses the problem before introducing the solution.',
            'Follow up within 24 hours of every meeting — every time.',
            'The close should feel like a natural next step, not a push.',
            'Most sales happen after 5+ contacts — consistent follow-up is where deals close.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What is the correct order of the sales process?', options: ['Close → Presentation → Needs Analysis → Approach', 'Approach → Close → Needs Analysis → Presentation', 'Approach → Needs Analysis → Presentation → Close → Follow-Up', 'Presentation → Approach → Needs Analysis → Close'], correctIndex: 2 },
              { id: 'q2', text: 'How soon should you follow up with a client after a meeting?', options: ['Within one week', 'Within 24 hours', 'When the client reaches out to you', 'Within the same month'], correctIndex: 1 },
              { id: 'q3', text: 'What should every presentation do before introducing a solution?', options: ['Show the product pricing first', 'Establish your credentials and awards', 'Address the client\'s specific problem', 'Present all available product options'], correctIndex: 2 },
              { id: 'q4', text: 'What makes a close feel natural rather than pushy?', options: ['Using scripted closing phrases', 'Applying pressure at the right moment', 'Tying it back to what the client said they want and need', 'Offering a discount to create urgency'], correctIndex: 2 },
              { id: 'q5', text: 'What does "rapport" mean in a sales context?', options: ['The length of time you\'ve known the client', 'Building genuine trust and connection with the client', 'Your sales track record and statistics', 'The paperwork used in the application process'], correctIndex: 1 },
              { id: 'q6', text: 'Research shows most sales happen after how many contacts?', options: ['1–2 contacts', '3 contacts', '5 or more contacts', '10+ contacts'], correctIndex: 2 },
              { id: 'q7', text: 'A client says "let me think about it." What is the best response?', options: ['Say "okay" and wait for them to call you', 'Push them to decide right now', 'Acknowledge it and schedule a specific follow-up time', 'Drop the client and move on'], correctIndex: 2 },
              { id: 'q8', text: 'What is the biggest mistake agents make at the close?', options: ['Not presenting enough product options', 'Talking too much and overselling after the client is already ready', 'Closing too early in the conversation', 'Not providing enough discounts'], correctIndex: 1 },
              { id: 'q9', text: 'Why is building rapport the first priority?', options: ['It is required by insurance licensing law', 'People buy from people they trust — trust comes before the sale', 'It saves time by skipping the needs analysis', 'It locks in the client before they can shop elsewhere'], correctIndex: 1 },
              { id: 'q10', text: 'When should you tie the solution back to the client\'s "why"?', options: ['Only at the close', 'Throughout the entire conversation and presentation', 'Only during the needs analysis', 'Only after the client raises an objection'], correctIndex: 1 }
            ]
          }
        }
      ]
    },
    {
      id: 'stage-3',
      label: 'Stage 3 — Performance',
      description: 'Advanced skills for handling objections and converting conversations into clients.',
      modules: [
        {
          id: 'mod-9',
          title: 'Role Play & Objection Handling',
          description: 'Turn objections into opportunities and become confident in any client conversation.',
          videoUrl: '',
          keyPoints: [
            'Most objections are NOT rejections — they are requests for more information.',
            '4-step objection response: Acknowledge → Clarify → Respond → Confirm.',
            '"I can\'t afford it" usually means they haven\'t seen enough value yet.',
            '"I need to think about it" often means they need one more piece of clarity.',
            'Practice objections with a partner weekly — consistency builds confidence.',
            'Never argue with a client — redirect with a question.',
            'The best prevention for objections is a thorough needs analysis upfront.'
          ],
          quiz: {
            passingScore: 8,
            questions: [
              { id: 'q1', text: 'What does an objection usually represent?', options: ['A final hard rejection you cannot overcome', 'A request for more information or clarity', 'The client lying to get a better price', 'A sign you should move on to another prospect'], correctIndex: 1 },
              { id: 'q2', text: 'What is the correct 4-step objection response process?', options: ['Respond → Argue → Clarify → Close', 'Acknowledge → Clarify → Respond → Confirm', 'Ignore → Present again → Close → Follow up', 'Clarify → Respond → Acknowledge → Move on'], correctIndex: 1 },
              { id: 'q3', text: 'When a client says "I can\'t afford it," what does this typically mean?', options: ['They genuinely have no money and cannot buy', 'They are comparing prices with competitors', 'They haven\'t seen enough value to justify the cost yet', 'The conversation is over'], correctIndex: 2 },
              { id: 'q4', text: 'When a client says "I need to think about it," the best response is:', options: ['Say "okay, call me when you\'re ready."', 'Apply pressure to decide now before they change their mind', 'Acknowledge it and ask what specific question they\'re still working through', 'Offer a discount immediately'], correctIndex: 2 },
              { id: 'q5', text: 'What is the best prevention for most objections?', options: ['Having a long list of rebuttals ready', 'Presenting the product before they can object', 'A thorough needs analysis conducted upfront', 'Offering the lowest price in the market'], correctIndex: 2 },
              { id: 'q6', text: 'What should you NEVER do when a client raises an objection?', options: ['Ask a clarifying question', 'Acknowledge their concern', 'Argue with them or dismiss their concern', 'Confirm your response addressed it'], correctIndex: 2 },
              { id: 'q7', text: 'How often should agents practice objection handling?', options: ['Once at training and never again', 'Only when they lose a sale', 'Regularly — at least weekly with a partner or in role play', 'Once a year at the annual company meeting'], correctIndex: 2 },
              { id: 'q8', text: 'Which response best handles the objection "I already have insurance"?', options: ['"Then you don\'t need me — have a great day."', '"That\'s great. Can I ask — do you know exactly what it covers and if it\'s still enough for where you are today?"', '"Your current insurance is probably not good enough."', '"Most people say that but don\'t actually have the right coverage."'], correctIndex: 1 },
              { id: 'q9', text: 'What does the "Confirm" step in the 4-step objection process mean?', options: ['Confirming the client will buy', 'Asking the client if your response addressed their concern', 'Sending a confirmation email after the meeting', 'Confirming the product price'], correctIndex: 1 },
              { id: 'q10', text: 'What is the best mindset to have when you face objections?', options: ['See them as personal rejection and prepare to move on', 'See them as opportunities to provide more clarity and deliver more value', 'Avoid clients who raise objections', 'View objections as a sign the client is not a good fit'], correctIndex: 1 }
            ]
          }
        }
      ]
    }
  ]
};
