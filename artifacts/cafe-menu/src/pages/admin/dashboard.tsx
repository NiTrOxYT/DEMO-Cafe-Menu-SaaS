import React, { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetMe, 
  useLogout, 
  useGetMenuSummary, 
  useListMenuItems, 
  useListCategories,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useCreateCategory,
  useDeleteCategory
} from "@workspace/api-client-react";
import { 
  Loader2, LogOut, Plus, Edit2, Trash2, Image as ImageIcon, CheckCircle, XCircle, LayoutGrid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { 
  getGetMeQueryKey, 
  getListMenuItemsQueryKey, 
  getGetMenuSummaryQueryKey,
  getListCategoriesQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  categoryId: z.coerce.number().min(1, "Category is required"),
  available: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  sortOrder: z.coerce.number().default(0),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  
  const { data: me, isLoading: meLoading, isError: meError } = useGetMe({
    query: { retry: false }
  });

  const { data: summary, isLoading: summaryLoading } = useGetMenuSummary({
    query: { enabled: !!me }
  });

  const { data: items, isLoading: itemsLoading } = useListMenuItems(undefined, {
    query: { enabled: !!me }
  });

  const { data: categories } = useListCategories({
    query: { enabled: !!me }
  });

  const logoutMutation = useLogout();
  const deleteItemMutation = useDeleteMenuItem();
  const createItemMutation = useCreateMenuItem();
  const updateItemMutation = useUpdateMenuItem();
  
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const itemForm = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      categoryId: 0,
      available: true,
      sortOrder: 0,
    },
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      sortOrder: 0,
    },
  });

  React.useEffect(() => {
    if (meError) {
      setLocation("/admin/login");
    }
  }, [meError, setLocation]);

  if (meLoading || itemsLoading || summaryLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!me) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/admin/login");
      }
    });
  };

  const handleDeleteItem = (id: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteItemMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMenuSummaryQueryKey() });
          toast({ description: "Item deleted successfully" });
        }
      });
    }
  };

  const handleDeleteCategory = (id: number) => {
    if (window.confirm("Are you sure you want to delete this category? All items in this category will be removed or unassigned.")) {
      deleteCategoryMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMenuSummaryQueryKey() });
          toast({ description: "Category deleted successfully" });
        }
      });
    }
  };

  const openEditItemDialog = (item: any) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      imageUrl: item.imageUrl || "",
      categoryId: item.categoryId,
      available: item.available,
      sortOrder: item.sortOrder,
    });
    setItemDialogOpen(true);
  };

  const openNewItemDialog = () => {
    setEditingItem(null);
    itemForm.reset({
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      categoryId: categories?.[0]?.id || 0,
      available: true,
      sortOrder: 0,
    });
    setItemDialogOpen(true);
  };

  const onItemSubmit = (data: MenuItemFormValues) => {
    const payload = {
      ...data,
      imageUrl: data.imageUrl || undefined,
      description: data.description || undefined,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMenuSummaryQueryKey() });
          setItemDialogOpen(false);
          toast({ description: "Item updated successfully" });
        }
      });
    } else {
      createItemMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMenuSummaryQueryKey() });
          setItemDialogOpen(false);
          toast({ description: "Item created successfully" });
        }
      });
    }
  };

  const onCategorySubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMenuSummaryQueryKey() });
        setCategoryDialogOpen(false);
        categoryForm.reset();
        toast({ description: "Category created successfully" });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-serif font-semibold text-foreground">The Golden Brew Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{me.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Items</CardDescription>
              <CardTitle className="text-3xl">{summary?.totalItems || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Categories</CardDescription>
              <CardTitle className="text-3xl">{summary?.totalCategories || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Items</CardDescription>
              <CardTitle className="text-3xl text-primary">{summary?.availableItems || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-3/4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif text-foreground">Menu Items</h2>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" onClick={openNewItemDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
                  </DialogHeader>
                  <Form {...itemForm}>
                    <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
                      <FormField control={itemForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={itemForm.control} name="price" render={({ field }) => (
                          <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={itemForm.control} name="categoryId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : undefined}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map(c => (
                                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={itemForm.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={itemForm.control} name="imageUrl" render={({ field }) => (
                        <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={itemForm.control} name="sortOrder" render={({ field }) => (
                          <FormItem><FormLabel>Sort Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={itemForm.control} name="available" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-[32px]">
                            <div className="space-y-0.5"><FormLabel className="text-base">Available</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                        {createItemMutation.isPending || updateItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {editingItem ? "Save Changes" : "Create Item"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No menu items found. Add your first item.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items?.sort((a, b) => a.categoryId - b.categoryId || a.sortOrder - b.sortOrder).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.imageUrl ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted">
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.categoryName}</TableCell>
                        <TableCell>${item.price.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.available ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Unavailable
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditItemDialog(item)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={deleteItemMutation.isPending && deleteItemMutation.variables?.id === item.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="w-full md:w-1/4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif text-foreground">Categories</h2>
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Add Category</DialogTitle>
                  </DialogHeader>
                  <Form {...categoryForm}>
                    <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                      <FormField control={categoryForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={categoryForm.control} name="sortOrder" render={({ field }) => (
                        <FormItem><FormLabel>Sort Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createCategoryMutation.isPending}>
                        {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Create Category
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableBody>
                  {categories?.sort((a, b) => a.sortOrder - b.sortOrder).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCategory(c.id)}
                          disabled={deleteCategoryMutation.isPending && deleteCategoryMutation.variables?.id === c.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No categories</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
