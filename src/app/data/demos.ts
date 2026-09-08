export interface Demo {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  techStack: string[];
  status: "live" | "wip" | "planned";
  colors: [string, string];
  icon: string;
  date: string;
  deploymentUrl: string;
  githubUrl: string;
  isPublic: boolean;
}
