import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
}

const BASE_URL = 'https://skyllswap.app';
const DEFAULT_TITLE = 'Skyllswap - Échange tes compétences';
const DEFAULT_DESCRIPTION =
  'Trouve des personnes proches de chez toi pour échanger vos compétences. Apprends, partage, progresse ensemble.';

export function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  type = 'website',
  image = `${BASE_URL}/og-image.svg`,
}: SeoProps) {
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | Skyllswap`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Skyllswap" />
      <meta property="og:locale" content="fr_FR" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <meta name="robots" content="index, follow" />
      <meta name="author" content="Skyllswap" />
      <meta name="keywords" content="échange compétences, apprentissage, partage,技能交换, skill swap, peer learning" />
    </Helmet>
  );
}
