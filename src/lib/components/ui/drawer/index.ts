import { Drawer as DrawerPrimitive } from 'vaul-svelte';
import Content from './drawer-content.svelte';
import Description from './drawer-description.svelte';
import Footer from './drawer-footer.svelte';
import Header from './drawer-header.svelte';
import Title from './drawer-title.svelte';

const Root = DrawerPrimitive.Root;
const Trigger = DrawerPrimitive.Trigger;
const Portal = DrawerPrimitive.Portal;
const Close = DrawerPrimitive.Close;
const Overlay = DrawerPrimitive.Overlay;

export {
  Root,
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
  //
  Root as Drawer,
  Content as DrawerContent,
  Header as DrawerHeader,
  Footer as DrawerFooter,
  Title as DrawerTitle,
  Description as DrawerDescription,
  Close as DrawerClose,
  Trigger as DrawerTrigger
};
