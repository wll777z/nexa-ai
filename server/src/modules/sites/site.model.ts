/** Modelo de dados compartilhado dos projetos de site (backend). */

export interface SiteBrief {
  companyName: string;
  segment?: string;
  description?: string;
  targetAudience?: string;
  services?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  instagram?: string;
  goal?: string;
  style?: string;
}

export type SiteLayout =
  | 'barbearia'
  | 'salao'
  | 'restaurante'
  | 'loja'
  | 'clinica'
  | 'servico'
  | 'generico';

export interface HeroSection {
  title: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
}
export interface AboutSection {
  title: string;
  text: string;
}
export interface ListSection {
  title: string;
  items: string[];
}
export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqSection {
  title: string;
  items: FaqItem[];
}
export interface GallerySection {
  title: string;
  images: string[];
}
export interface ContactSection {
  title: string;
  whatsapp: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
}
export interface FooterSection {
  text: string;
}
export interface ColorSection {
  primary: string;
  background: string;
}

export interface SiteContent {
  layout: SiteLayout;
  hero: HeroSection;
  about: AboutSection;
  differentials: ListSection;
  services: ListSection;
  faq: FaqSection;
  gallery: GallerySection;
  contact: ContactSection;
  footer: FooterSection;
  colors: ColorSection;
}
