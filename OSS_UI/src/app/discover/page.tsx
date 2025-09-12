'use client';

import { Search, TrendingUp, Cpu, Brain, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DiscoverItem {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

// AI Market focused content with working images
const aiMarketContent: Record<string, DiscoverItem[]> = {
  'ai-startups': [
    {
      title: 'OpenAI Raises $6.6B in Historic AI Funding Round',
      content: 'OpenAI secures massive funding at $157B valuation, marking the largest AI investment in history.',
      url: 'https://openai.com/blog/',
      thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Anthropic Unveils Claude 3.5 with Advanced Reasoning',
      content: 'Anthropic releases Claude 3.5 with breakthrough capabilities in mathematical reasoning and code generation.',
      url: 'https://www.anthropic.com/',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Microsoft AI Division Reports Record Growth',
      content: 'Microsoft AI services generate $18B in revenue, driven by Copilot and Azure AI adoption.',
      url: 'https://news.microsoft.com/',
      thumbnail: 'https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Google DeepMind Achieves Protein Folding Breakthrough',
      content: 'AlphaFold 3 predicts protein structures with 95% accuracy, revolutionizing drug discovery.',
      url: 'https://deepmind.google/',
      thumbnail: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=225&fit=crop&auto=format'
    }
  ],
  'ai-enterprise': [
    {
      title: 'Fortune 500 Companies Accelerate AI Adoption',
      content: '78% of Fortune 500 companies now use AI in production, up 45% from last year.',
      url: 'https://www.ibm.com/artificial-intelligence',
      thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Salesforce Einstein AI Powers $2B in Revenue',
      content: 'Salesforce Einstein AI platform drives significant business value across 150,000+ customers.',
      url: 'https://www.salesforce.com/products/einstein/',
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'AWS AI Services Reach 50M Monthly Users',
      content: 'Amazon Web Services AI and ML tools see explosive growth in enterprise adoption.',
      url: 'https://aws.amazon.com/machine-learning/',
      thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop&auto=format'
    }
  ],
  'ai-hardware': [
    {
      title: 'NVIDIA H100 GPUs Drive $60B AI Chip Market',
      content: 'NVIDIA dominates AI chip market with H100 and H200 GPUs powering major AI workloads.',
      url: 'https://www.nvidia.com/en-us/data-center/h100/',
      thumbnail: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'AMD Launches MI300X AI Accelerator',
      content: 'AMD challenges NVIDIA with new MI300X chips designed for large language model training.',
      url: 'https://www.amd.com/en/products/accelerators.html',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Intel Unveils Gaudi 3 AI Training Processors',
      content: 'Intel enters AI chip race with Gaudi 3 processors targeting cost-effective AI training.',
      url: 'https://www.intel.com/content/www/us/en/artificial-intelligence/overview.html',
      thumbnail: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=400&h=225&fit=crop&auto=format'
    }
  ],
  'ai-research': [
    {
      title: 'MIT Develops Self-Improving AI Algorithms',
      content: 'MIT researchers create AI systems that can automatically optimize their own performance.',
      url: 'https://news.mit.edu/topic/artificial-intelligence2',
      thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'Stanford AI Lab Achieves AGI Milestone',
      content: 'Stanford researchers demonstrate AI system with human-level performance across multiple domains.',
      url: 'https://hai.stanford.edu/',
      thumbnail: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'OpenAI Publishes GPT-4 Training Insights',
      content: 'Detailed research paper reveals training methodologies behind GPT-4 architecture.',
      url: 'https://arxiv.org/list/cs.AI/recent',
      thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop&auto=format'
    }
  ],
  'ai-regulation': [
    {
      title: 'EU AI Act Implementation Begins',
      content: 'European Union starts enforcing comprehensive AI regulation framework affecting global tech companies.',
      url: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
      thumbnail: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'US Senate Proposes AI Safety Standards',
      content: 'Bipartisan legislation aims to establish safety requirements for advanced AI systems.',
      url: 'https://www.congress.gov/',
      thumbnail: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=225&fit=crop&auto=format'
    },
    {
      title: 'China Unveils National AI Strategy 2025',
      content: 'China announces $100B investment plan to achieve AI leadership by 2025.',
      url: 'https://www.gov.cn/',
      thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=225&fit=crop&auto=format'
    }
  ]
};

const topics: { key: string; display: string; icon: React.ReactNode }[] = [
  { display: 'AI Startups', key: 'ai-startups', icon: <Zap className="w-4 h-4" /> },
  { display: 'Enterprise AI', key: 'ai-enterprise', icon: <TrendingUp className="w-4 h-4" /> },
  { display: 'AI Hardware', key: 'ai-hardware', icon: <Cpu className="w-4 h-4" /> },
  { display: 'AI Research', key: 'ai-research', icon: <Brain className="w-4 h-4" /> },
  { display: 'AI Policy', key: 'ai-regulation', icon: <Search className="w-4 h-4" /> },
];

const Page = () => {
  const [discover, setDiscover] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState<string>(topics[0].key);

  const loadContent = (topic: string) => {
    setLoading(true);
    
    setTimeout(() => {
      const content = aiMarketContent[topic] || aiMarketContent['ai-startups'];
      const shuffledContent = [...content].sort(() => Math.random() - 0.5);
      setDiscover(shuffledContent);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadContent(activeTopic);
  }, [activeTopic]);

  const handleTopicChange = (topic: string) => {
    setActiveTopic(topic);
  };

  const openExternalLink = (url: string) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.require) {
          const { shell } = window.require('electron');
          shell.openExternal(url);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 overflow-hidden">
      
      {/* Header Section */}
      <div className="flex-shrink-0">
        <div className="flex items-center mb-4">
          <Brain className="w-8 h-8 mr-3 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold">AI Market Insights</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Latest news from the artificial intelligence industry</p>
          </div>
        </div>
        <hr className="border-t border-gray-200 dark:border-gray-700 my-4 w-full" />
        <div className="flex flex-row items-center space-x-3 overflow-x-auto pb-4">
          {topics.map((t, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 border rounded-full text-sm px-4 py-2 text-nowrap transition duration-200 cursor-pointer whitespace-nowrap',
                activeTopic === t.key
                  ? 'text-white bg-blue-600 border-blue-600 shadow-sm'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500',
              )}
              onClick={() => handleTopicChange(t.key)}
            >
              {t.icon}
              <span>{t.display}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading AI market news...</p>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-6 pt-5 pb-6">
            {discover.length > 0 ? (
              discover.map((item, i) => (
                <div
                  key={i}
                  onClick={() => openExternalLink(item.url)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden group hover:scale-[1.02]"
                >
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://via.placeholder.com/400x225/3B82F6/FFFFFF?text=AI+News`;
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-3 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                      {item.content}
                    </p>
                    <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                      <span>Read more</span>
                      <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500">
                <Brain className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">No AI news available</p>
                <p className="text-sm">Try selecting a different category</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

export default Page;
