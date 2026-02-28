# MCPMarket Landing Page

Modern, responsive landing page for MCPMarket - the ultimate MCP server marketplace and installer for Windows.

![MCPMarket](public/screenshot.png)

## Features

- 🎨 **Modern Dark Theme** - Beautiful gradient background with glassmorphism effects
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices
- ⚡ **Fast Loading** - Pure HTML/CSS with minimal JavaScript
- 🔍 **SEO Optimized** - Proper meta tags and semantic HTML
- ♿ **Accessible** - WCAG compliant with proper contrast ratios
- 🎯 **Clear CTAs** - Multiple call-to-action buttons for downloads and GitHub

## Sections

1. **Hero Section** - Eye-catching introduction with feature highlights
2. **Features Grid** - 6 core features with icons and descriptions
3. **Server Showcase** - Visual display of 20+ pre-configured MCP servers
4. **IDE Support** - Grid showing supported IDEs with config paths
5. **Metrics** - Key statistics (20+ servers, 8 IDEs, 4 package managers)
6. **CTA Panel** - Prominent download call-to-action
7. **FAQ** - Common questions and answers
8. **Footer** - Navigation links and copyright

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS variables
- **JavaScript** - Minimal interactions (smooth scrolling, loading animation)
- **Font Awesome** - Icons
- **Google Fonts** - Space Grotesk & Manrope

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Site will be available at `http://localhost:3000`

### Static Deployment

The site is fully static and can be deployed anywhere:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop the folder
- **GitHub Pages**: Push to `gh-pages` branch
- **Any static hosting**: Upload the files

## Customization

### Colors

Edit CSS variables in `landing.css`:

```css
:root {
  --accent: #d4a82f;  /* Primary accent color */
  --bg-0: #07080f;    /* Background color */
  --text: #f5f7ff;     /* Text color */
}
```

### Content

All content is in `index.html`. Edit sections:

- Hero: Lines 37-75
- Features: Lines 77-103
- Servers: Lines 105-125
- IDEs: Lines 127-155
- FAQ: Lines 167-187

## Performance

- **Lighthouse Score**: 95+
- **First Contentful Paint**: < 1s
- **Time to Interactive**: < 2s
- **Total Bundle Size**: ~50KB (HTML + CSS)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - see LICENSE file for details

## Links

- **Main Project**: https://github.com/mcpmarket/mcpmarket
- **Releases**: https://github.com/mcpmarket/mcpmarket/releases
- **MCP Protocol**: https://modelcontextprotocol.io

---

Built with ❤️ for the AI developer community
