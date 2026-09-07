import type React from 'react'
import { useNavigate } from 'react-router'
import { PageGrid, PageGridRightColumn } from '@/components/page-grid'
import { TopBar } from '@/components/ui/top-bar'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { ChessArenaLogo } from '@/components/ui/chess-arena-logo'

type ParagraphProps = React.PropsWithChildren<{ className?: string }>

const Paragraph: React.FC<ParagraphProps> = ({ children, className }) => {
  return <p className={cn('font-medium text-white/90 w-full text-justify', className)}>{children}</p>
}

export const AboutPage = () => {
  const navigate = useNavigate()
  const onBack = () => navigate('/')

  usePageTitle('About')

  return (
    <PageGrid>
      <PageGridRightColumn>
        <TopBar onBack={onBack} />
        <div className="flex flex-col gap-2 items-center justify-center">
          <ChessArenaLogo className="mb-6" />

          <Paragraph>
            Welcome to KHChess — a platform to explore how large language models (LLMs) perform in real chess games.
          </Paragraph>

          <Paragraph>
            Pick a model, play it, or challenge a friend with an invite link. Each game is evaluated move-by-move with{' '}
            <a href="https://stockfishchess.org/" target="_blank" className="text-white underline">
              Stockfish
            </a>
            , the world's strongest open-source chess engine, so we track move quality and game insight rather than just
            wins and losses.
          </Paragraph>

          <h2 className="text-2xl font-title text-white my-4">How's it evaluated?</h2>

          <Paragraph>
            On each move, we compare the model's move against Stockfish's best move to get the difference, called move
            swing. If the move swing is higher than 100 centipawns, we consider it a blunder.
          </Paragraph>

          <h2 className="text-2xl font-title text-white my-4">More</h2>

          <Paragraph>
            KHChess works offline as an installable app (PWA) and is available in English and Khmer. The source code is
            open on{' '}
            <a href="https://github.com/keovoin/KHChess" target="_blank" className="text-white underline">
              GitHub
            </a>
            .
          </Paragraph>
        </div>
      </PageGridRightColumn>
    </PageGrid>
  )
}
